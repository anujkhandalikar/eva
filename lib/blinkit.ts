import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

export type CartItem = {
  requested: string;
  name: string;
  product_id: string;
  quantity: number;
  unit_price: string;
  url?: string;
  not_found?: boolean;
};

export async function createBlinkitClient(): Promise<Client> {
  const url = process.env.BLINKIT_MCP_URL ?? "http://localhost:8000/sse";
  const transport = new SSEClientTransport(new URL(url));
  const client = new Client({ name: "eva", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
): Promise<string> {
  console.log(`[blinkit] → ${name}`, Object.keys(args).length ? args : "");
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as Array<{ type: string; text?: string }>;
  const text = content.find((c) => c.type === "text")?.text ?? "";
  console.log(`[blinkit] ← ${name}:`, text.slice(0, 600));
  return text;
}

/**
 * Strict match: only return the search result whose ID equals the SKU map id.
 * No brand fallback, no [0] fallback — user wants ONLY their specific product.
 * Search results format: "[0] ID: <id> | <name> - ₹<price>"
 */
export function pickProductId(searchOutput: string, item: CartItem): string | null {
  const lines = searchOutput
    .split("\n")
    .map((l) => {
      const m = l.match(/^\[(\d+)\]\s*ID:\s*([^\s|]+)\s*\|\s*(.+?)\s*-\s*₹/);
      return m ? { index: parseInt(m[1], 10), id: m[2], name: m[3] } : null;
    })
    .filter((x): x is { index: number; id: string; name: string } => x !== null);

  if (lines.length === 0) {
    console.log(`[blinkit] search returned no parseable results`);
    return null;
  }

  const exactMatch = lines.find((l) => l.id === item.product_id);
  if (exactMatch) {
    console.log(`[blinkit] match by SKU id: [${exactMatch.index}] ${exactMatch.name}`);
    return exactMatch.id;
  }

  console.log(`[blinkit] SKU id ${item.product_id} NOT in search results. Available IDs: ${lines.map((l) => l.id).join(", ")}`);
  return null;
}

export async function executeOrder(
  cart: CartItem[]
): Promise<{ success: boolean; summary: string }> {
  console.log("[blinkit] executeOrder start, cart:", JSON.stringify(cart));
  const mcp = await createBlinkitClient();
  try {
    // Verify session
    const loginStatus = await callTool(mcp, "check_login");
    if (loginStatus.includes("Not Logged In")) {
      throw new Error("Blinkit session expired. Re-login required — rerun the task.");
    }

    const itemsToAdd = cart.filter((i) => !i.not_found && i.product_id);
    if (itemsToAdd.length === 0) {
      throw new Error("No valid items in cart to order.");
    }

    // Required by MCP: set location before interacting with cart.
    // Without this, Blinkit shows a location overlay that blocks all ADD buttons.
    const locationResult = await callTool(mcp, "set_location", { location_name: "detect" });
    console.log("[blinkit] set_location:", locationResult);

    // CRITICAL: clear the entire cart before adding new items.
    // Previous failed attempts pollute the cart — by the screenshot we hit 14 items.
    // remove_from_cart only handles the same SKU; this nukes everything.
    const clearResult = await callTool(mcp, "clear_cart");
    console.log("[blinkit] clear_cart:", clearResult.slice(0, 400));

    // For each item: search → find product matching stored product_id → add fresh qty.
    // Use item.requested (raw phrase) — same query that produced the stored ID at proposal
    // time. Searching by item.name (chosen display name) may return different rankings/IDs
    // and break strict ID match in pickProductId.
    for (const item of itemsToAdd) {
      const query = item.requested || item.name;
      const searchOutput = await callTool(mcp, "search", { query });
      console.log("[blinkit] search output:", searchOutput.slice(0, 1500));

      const domId = pickProductId(searchOutput, item);
      if (!domId) {
        throw new Error(`No matching product for "${item.name}" in search results.`);
      }
      console.log(`[blinkit] picked DOM id ${domId} for "${item.name}" (stored id ${item.product_id})`);

      // Add the correct quantity
      await callTool(mcp, "add_to_cart", { item_id: domId, quantity: item.quantity });
    }

    // Checkout — clicks "Proceed To Pay" in cart drawer.
    const checkoutResult = await callTool(mcp, "checkout");
    console.log("[blinkit] checkout result:", checkoutResult);
    if (
      checkoutResult.includes("Cart might be empty") ||
      checkoutResult.includes("Store Unavailable") ||
      checkoutResult.includes("store is closed")
    ) {
      throw new Error(`Checkout failed: ${checkoutResult.slice(0, 300)}`);
    }

    // After Proceed To Pay, Blinkit shows an address selection prompt.
    // Find the address labeled "Home" and click it. If no Home address found,
    // assume default is already selected and continue.
    const addressResult = await callTool(mcp, "select_address_by_label", { label: "Home" });
    console.log("[blinkit] address selection:", addressResult);

    // Select payment — auto-picks COD, falls back to UPI QR
    const paymentResult = await callTool(mcp, "select_payment_method");
    console.log("[blinkit] payment method result:", paymentResult);

    // pay_now clicks "Pay Now" (UPI) or "Place Order" (COD)
    console.log("[blinkit] calling pay_now to finalise");
    const payResult = await callTool(mcp, "pay_now");
    console.log("[blinkit] pay_now result:", payResult);
    if (payResult.includes("Could not find")) {
      throw new Error(`Payment failed: ${payResult.slice(0, 200)}`);
    }

    const summary = itemsToAdd.map((i) => `${i.name} ×${i.quantity}`).join(", ");
    console.log("[blinkit] executeOrder complete:", summary);
    return { success: true, summary: `Order placed: ${summary}` };
  } finally {
    await mcp.close();
  }
}

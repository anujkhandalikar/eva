import { inngest } from "./client";
import { supabase } from "@/lib/supabase";
import { processTask } from "@/lib/openai";
import { createBlinkitClient, callTool, CartItem } from "@/lib/blinkit";
import { lookupSKU, parseQuantity } from "@/lib/skuMap";

function detectOrderIntent(input: string): boolean {
  const keywords = ["order", "buy", "get me", "purchase"];
  return keywords.some((k) => input.toLowerCase().includes(k));
}

export const executeTask = inngest.createFunction(
  {
    id: "execute-task",
    triggers: [{ event: "task/created" }],
    retries: 3,
    concurrency: { limit: 3 },
  },
  async ({ event, step }) => {
    const { id, input } = event.data;

    await step.run("update-status-running", async () => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "running" })
        .eq("id", id);
      if (error) throw error;
    });

    if (!detectOrderIntent(input)) {
      // --- Research path (unchanged) ---
      try {
        const result = await step.run("process-with-openai", async () => {
          return await processTask(input);
        });

        await step.run("update-status-success", async () => {
          const status = result.requires_approval ? "needs_approval" : "done";
          const { error } = await supabase
            .from("tasks")
            .update({
              status,
              result_summary: result.summary,
              result_full: result.full_result,
              requires_approval: result.requires_approval,
            })
            .eq("id", id);
          if (error) throw error;
        });

        return { success: true };
      } catch (error: unknown) {
        await step.run("update-status-failed", async () => {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          await supabase
            .from("tasks")
            .update({ status: "failed", error_reason: message })
            .eq("id", id);
        });
        throw error;
      }
    }

    // --- Blinkit order path ---
    await step.run("set-task-type", async () => {
      const { error } = await supabase
        .from("tasks")
        .update({ task_type: "blinkit_order" })
        .eq("id", id);
      if (error) throw error;
    });

    try {
      // Parse items from input using gpt-4o-mini
      const parsedItems = await step.run("parse-items", async () => {
        const { default: OpenAI } = await import("openai");
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const res = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `Extract items and quantities from a grocery order request.
Respond with ONLY valid JSON: {"items": [{"name": "item name", "quantity": 1}]}
Use the exact item name the user said. Default quantity to 1 if not specified.`,
            },
            { role: "user", content: input },
          ],
        });
        const text = res.choices[0]?.message?.content ?? '{"items":[]}';
        try {
          const parsed = JSON.parse(text) as { items: { name: string; quantity: number }[] };
          return parsed.items;
        } catch {
          // Fallback: treat whole input as one item
          return [{ name: input, quantity: parseQuantity(input) }];
        }
      });

      // Resolve items: SKU map first, MCP search as fallback
      const unknownItems = parsedItems.filter((item) => !lookupSKU(item.name));
      const needsMCP = unknownItems.length > 0;

      // Handle login only if we need to search via MCP
      if (needsMCP) {
        const loginStatus = await step.run("blinkit-check-login", async () => {
          const mcp = await createBlinkitClient();
          try {
            return await callTool(mcp, "check_login");
          } finally {
            await mcp.close();
          }
        });

        if (loginStatus.includes("Not Logged In")) {
          await step.run("blinkit-send-otp", async () => {
            const phone = process.env.BLINKIT_PHONE;
            if (!phone) throw new Error("BLINKIT_PHONE env var not set");
            const mcp = await createBlinkitClient();
            try {
              await callTool(mcp, "login", { phone_number: phone });
            } finally {
              await mcp.close();
            }
          });

          await step.run("update-status-needs-otp", async () => {
            const { error } = await supabase
              .from("tasks")
              .update({ status: "needs_otp" })
              .eq("id", id);
            if (error) throw error;
          });

          const otpEvent = await step.waitForEvent("wait-for-otp", {
            event: "blinkit/otp.submitted",
            timeout: "5m",
            match: "data.taskId",
          });

          if (!otpEvent) {
            throw new Error("OTP not entered in time (5 min timeout).");
          }

          await step.run("blinkit-enter-otp", async () => {
            const mcp = await createBlinkitClient();
            try {
              await callTool(mcp, "enter_otp", { otp: otpEvent.data.otp });
            } finally {
              await mcp.close();
            }
          });

          await step.run("update-status-running-after-otp", async () => {
            const { error } = await supabase
              .from("tasks")
              .update({ status: "running" })
              .eq("id", id);
            if (error) throw error;
          });
        }
      }

      // Build proposed cart
      const proposedCart = await step.run("build-cart", async () => {
        const cart: CartItem[] = [];
        const mcp = needsMCP ? await createBlinkitClient() : null;

        try {
          for (const item of parsedItems) {
            const sku = lookupSKU(item.name);

            if (sku) {
              // Exact match from SKU map — no MCP needed
              cart.push({
                requested: item.name,
                name: sku.name,
                product_id: sku.id,
                quantity: item.quantity,
                unit_price: "",
              });
              continue;
            }

            // Fall back to MCP search
            if (!mcp) {
              cart.push({
                requested: item.name,
                name: item.name,
                product_id: "",
                quantity: item.quantity,
                unit_price: "",
                not_found: true,
              });
              continue;
            }

            const searchResult = await callTool(mcp, "search", { query: item.name });
            if (!searchResult || searchResult.includes("No results found")) {
              cart.push({
                requested: item.name,
                name: item.name,
                product_id: "",
                quantity: item.quantity,
                unit_price: "",
                not_found: true,
              });
              continue;
            }

            const lines = searchResult
              .split("\n")
              .filter((l) => l.match(/^\[(\d+)\]/));

            if (lines.length === 0) {
              cart.push({
                requested: item.name,
                name: item.name,
                product_id: "",
                quantity: item.quantity,
                unit_price: "",
                not_found: true,
              });
              continue;
            }

            const { default: OpenAI } = await import("openai");
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const top5 = lines.slice(0, 5).join("\n");
            const pick = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                {
                  role: "user",
                  content: `I want: "${item.name}"\n\nResults:\n${top5}\n\nReply with ONLY the index number of the best match.`,
                },
              ],
            });
            const index = parseInt(
              pick.choices[0]?.message?.content?.trim() ?? "0",
              10
            ) || 0;
            const chosen = lines[index] ?? lines[0];

            const idMatch = chosen.match(/ID:\s*([^\s|]+)/);
            const priceMatch = chosen.match(/₹[\d,]+/);
            const nameMatch = chosen.match(/\|\s*(.+?)\s*-\s*₹/);

            cart.push({
              requested: item.name,
              name: nameMatch?.[1]?.trim() ?? item.name,
              product_id: idMatch?.[1] ?? "",
              quantity: item.quantity,
              unit_price: priceMatch?.[0] ?? "",
              not_found: !idMatch?.[1],
            });
          }
        } finally {
          if (mcp) await mcp.close();
        }

        return cart;
      });

      // Save cart and set needs_approval
      await step.run("update-needs-approval", async () => {
        const foundItems = proposedCart.filter((i) => !i.not_found);
        const summary =
          proposedCart
            .map((i) =>
              i.not_found
                ? `- ${i.requested} (not found)`
                : `- ${i.name} ×${i.quantity}${i.unit_price ? ` — ${i.unit_price}` : ""}`
            )
            .join("\n");

        const { error } = await supabase
          .from("tasks")
          .update({
            status: foundItems.length > 0 ? "needs_approval" : "failed",
            error_reason: foundItems.length === 0 ? "None of the requested items were found on Blinkit." : null,
            requires_approval: foundItems.length > 0,
            proposed_cart: proposedCart,
            result_summary: summary,
          })
          .eq("id", id);
        if (error) throw error;
      });

      return { success: true };
    } catch (error: unknown) {
      await step.run("update-status-failed-blinkit", async () => {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        await supabase
          .from("tasks")
          .update({ status: "failed", error_reason: message })
          .eq("id", id);
      });
      throw error;
    }
  }
);

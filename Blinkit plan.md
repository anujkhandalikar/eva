# Blinkit Integration Plan

> Goal: type "order me 5 Diet Coke cans" → Eva builds a proposed cart → you approve on the dashboard → Eva places the order on Blinkit. Real money, real order. Approval is mandatory.

---

## End-to-End User Flow

```
User types: "order me 5 Diet Coke cans"
  ↓
Hotkey → overlay → POST /api/tasks
  ↓
Inngest: executeTask fires
  ↓
  step: detect intent → "blinkit_order", items: [{name: "Diet Coke", qty: 5}]
  ↓
  step: check_login (fresh MCP connection, close after)
    → "Not Logged In":
        login(BLINKIT_PHONE) → close MCP
        UPDATE task: status = needs_otp
        step.waitForEvent("blinkit/otp.submitted", timeout: 5m)
        → user enters OTP on dashboard → POST /api/tasks/[id]/otp
        → Inngest resumes with { otp }
        step: enter_otp(otp) (fresh MCP connection, close after)
    → "Logged In": continue
  ↓
  step: search phase (fresh MCP connection)
    For each item: search(query) → gpt-4o-mini picks best match
    Build proposed_cart: [{requested, name, product_id, quantity, unit_price, not_found?}]
    Close MCP
  ↓
  UPDATE task: status = needs_approval, proposed_cart = [...], requires_approval = true
  ↓
  Dashboard: order card shows line items + total + "Place Order" button
  ↓
  User clicks "Place Order"
  ↓
  POST /api/tasks/[id]/approve
    → reads proposed_cart from Supabase (not from event payload)
    → fires Inngest event: blinkit/order.approved { taskId }
  ↓
  Inngest: placeBlinkitOrder fires
    step: read proposed_cart from Supabase
    step: add_to_cart for each item (fresh MCP, keep open for whole placement phase)
    step: check_cart → verify address; if wrong: get_addresses → select_address(BLINKIT_HOME_ADDRESS_INDEX)
    step: checkout
    step: select_payment_method (auto-COD; falls back to UPI QR)
    step: pay_now
    Close MCP
  ↓
  UPDATE task: status = done, result_summary = "Order placed."
```

---

## Architecture: How Eva Calls the Blinkit MCP

**Eva's Node.js backend (Inngest job) connects to the Blinkit MCP SSE server at `localhost:8000` using `@modelcontextprotocol/sdk`.**

Claude API is NOT used for MCP orchestration — Anthropic's servers are remote and cannot reach `localhost:8000`. Eva calls each MCP tool explicitly.

**Critical: MCP connections do not survive Inngest step boundaries.** `step.waitForEvent` pauses execution entirely — all in-memory state, including SSE connections, is gone when the function resumes. Every step that needs MCP must open a fresh connection, use it, and close it before returning.

```typescript
// lib/blinkit.ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

export async function createBlinkitClient(): Promise<Client> {
  const transport = new SSEClientTransport(
    new URL(process.env.BLINKIT_MCP_URL ?? "http://localhost:8000/sse")
  );
  const client = new Client({ name: "eva", version: "1.0.0" });
  await client.connect(transport);
  return client;
}

export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown> = {}
): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  return (result.content as Array<{ text: string }>)[0]?.text ?? "";
}
```

Usage pattern in every step:
```typescript
await step.run("some-mcp-step", async () => {
  const mcp = await createBlinkitClient();
  try {
    const result = await callTool(mcp, "search", { query: "Diet Coke" });
    return result;
  } finally {
    await mcp.close();
  }
});
```

---

## Prerequisites (Step 0 — Before Any Code)

The Blinkit MCP repo is already cloned at `~/blinkit-mcp`. Run once:

```bash
cd ~/blinkit-mcp
uv sync
uv run playwright install firefox
```

Start the MCP server (must be running before any order task fires):
```bash
cd ~/blinkit-mcp
SERVE_HTTPS=true HEADLESS=false uv run main.py
# Runs at http://localhost:8000
# HEADLESS=false shows the browser — useful for first-run OTP and debugging
# Switch to HEADLESS=true after login session is established
```

Find your home address index (run once after logging in):
```
In Claude Desktop with Blinkit MCP connected: call get_addresses
Note the index number of your home address.
```

---

## Environment Variables (`.env.local`)

```
BLINKIT_MCP_URL=http://localhost:8000/sse
BLINKIT_PHONE=+91XXXXXXXXXX
BLINKIT_HOME_ADDRESS_INDEX=0        # set after running get_addresses
```

---

## OTP / Login — One-Time Setup

Session saved to `~/.blinkit_mcp/cookies/auth.json`. Persists across MCP restarts. OTP only needed on first run or if session expires.

```
step: check_login → "Not Logged In"
  → step: login(BLINKIT_PHONE) + close MCP
  → UPDATE task: status = needs_otp
  → step.waitForEvent("blinkit/otp.submitted", { timeout: "5m", match: "data.taskId" })
  → [user enters OTP on dashboard]
  → step: reconnect MCP, enter_otp(otp), close MCP
  → continue

If timeout (5 min): task → failed, error_reason = "OTP not entered in time."
```

---

## COD Payment

Source-confirmed in `checkout.py` — `select_payment_method()`:
1. Looks for `div[title='Cash']` in payment iframe
2. If available and not disabled → clicks → "Selected Cash on Delivery"
3. If unavailable → generates UPI QR code as fallback

No special handling needed. Call `select_payment_method` then `pay_now`.

---

## Closest Match Selection

`search(query)` returns `[{ index, id, name, price }]` — prices included.

```
For each requested item:
  1. call search(item.name)
  2. pass top 5 results + original name to gpt-4o-mini
     prompt: "Pick the best match for '{name}' from these results. Return only the index number."
  3. use that result's id + price in proposed_cart
  4. if search returns nothing: mark item as not_found: true, continue
```

---

## Data Model Changes

### New Supabase columns

```sql
ALTER TABLE tasks ADD COLUMN task_type text NOT NULL DEFAULT 'research';
-- values: 'research' | 'blinkit_order'

ALTER TABLE tasks ADD COLUMN proposed_cart jsonb;
-- CartItem[] shape below
```

### New status value: `needs_otp`

Check whether `status` is a text column or a Postgres enum. If enum:
```sql
ALTER TYPE task_status ADD VALUE 'needs_otp';
```
If text column: no migration needed, just update TypeScript types.

### Updated TypeScript types

```typescript
// CartItem — stored in proposed_cart jsonb column
type CartItem = {
  requested: string;       // original user ask
  name: string;            // matched product name on Blinkit
  product_id: string;
  quantity: number;
  unit_price: string;      // e.g. "₹99"
  not_found?: boolean;
};

// Task type — make new fields optional so existing consumers compile without changes
type Task = {
  id: string;
  created_at: string;
  input: string;
  status: 'pending' | 'running' | 'done' | 'needs_approval' | 'failed' | 'needs_otp';
  result_summary: string | null;
  result_full: string | null;
  error_reason: string | null;
  requires_approval: boolean;
  approved: boolean;
  task_type?: 'research' | 'blinkit_order';   // optional — defaults to 'research'
  proposed_cart?: CartItem[] | null;           // optional — null for research tasks
};
```

---

## Inngest: Event Types

Update `inngest/client.ts` to add new events:

```typescript
type Events = {
  "task/created": {
    data: { id: string; input: string };
  };
  "blinkit/otp.submitted": {
    data: { taskId: string; otp: string };
  };
  "blinkit/order.approved": {
    data: { taskId: string };
    // proposed_cart is NOT passed here — placeBlinkitOrder reads it from Supabase
    // this avoids stale event data overriding what's in the DB
  };
};
```

---

## Inngest: Function Structure

### `executeTask` (modified)

Triggered by `task/created`. Handles ALL tasks — intent detection happens inside, not at trigger time (we can't filter by task_type before it's been classified).

```
step: detect-intent
  → gpt-4o-mini: is this a blinkit order? if yes, extract items. if no, say research.
  → returns { type: 'research' } | { type: 'blinkit_order', items: [...] }

if research → existing OpenAI path, unchanged

if blinkit_order:
  step: update task_type = 'blinkit_order' in Supabase
  step: check-login (MCP open → check → close)
  [otp flow if needed — see above]
  step: search-items (MCP open → search all items → close)
  step: update-needs-approval (save proposed_cart, status = needs_approval)
```

### `placeBlinkitOrder` (new)

Triggered by `blinkit/order.approved`. Reads cart from Supabase.

```
step: read-task → fetch proposed_cart from Supabase by taskId
step: update-status-running
step: place-order (single MCP connection, kept open for all sub-steps)
  add_to_cart for each non-not_found item
  check_cart → if wrong address: get_addresses → select_address(BLINKIT_HOME_ADDRESS_INDEX)
  checkout
  select_payment_method
  pay_now
  close MCP
step: update-status-done
```

### Registration in `/api/inngest/route.ts`

```typescript
import { placeBlinkitOrder } from "@/inngest/placeBlinkitOrder";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [executeTask, placeBlinkitOrder],  // ← add new function
});
```

---

## New API Endpoints

### `POST /api/tasks/[id]/approve` (new file)

```typescript
// app/api/tasks/[id]/approve/route.ts
// Reads task from Supabase to verify it's a blinkit_order in needs_approval state
// Fires: blinkit/order.approved { taskId: id }
// Does NOT pass proposed_cart in event — placeBlinkitOrder reads from DB
```

### `POST /api/tasks/[id]/otp` (new file)

```typescript
// app/api/tasks/[id]/otp/route.ts
// body: { otp: string }
// Fires: blinkit/otp.submitted { taskId: id, otp }
```

### `POST /api/tasks/[id]/rerun` (update existing)

Must also clear `proposed_cart` when rerunning a blinkit order task:
```typescript
// add to the update payload:
proposed_cart: null,
task_type: 'research',  // reset; intent detection will re-classify
```

---

## Frontend Changes

### `TaskCard.tsx` and `SwipeableTaskCard.tsx` — both need updating

Both files independently define `TaskStatus`, `statusColors`, and `statusLabels`. Both need:

1. `needs_otp` added to the status type, colors (blue), and labels
2. The `Task` type updated with optional `task_type` and `proposed_cart` fields
3. New conditional rendering for blinkit states

For `needs_approval` + `task_type === 'blinkit_order'`:
```tsx
{task.task_type === 'blinkit_order' && task.proposed_cart && task.status === 'needs_approval' && (
  <BlinkitCartPreview cart={task.proposed_cart} taskId={task.id} />
)}
```

For `needs_otp`:
```tsx
{task.status === 'needs_otp' && (
  <OtpInput taskId={task.id} />
)}
```

### Drag conflict in `SwipeableTaskCard`

The card uses `drag='x'`. Buttons inside it (`BlinkitCartPreview`, `OtpInput`) must call `e.stopPropagation()` on click events to prevent drag from intercepting them. The existing link button already does this — new components must follow the same pattern.

### New sub-components

**`app/components/BlinkitCartPreview.tsx`**
- Line-item list: item name, qty, unit price (strikethrough + "Not found" for `not_found` items)
- Estimated total (sum of available items)
- "Place Order" button → `POST /api/tasks/[id]/approve`

**`app/components/OtpInput.tsx`**
- Single line: "Enter OTP sent to your phone"
- 6-digit input + "Submit" button → `POST /api/tasks/[id]/otp`

---

## Build Order

0. **Blinkit MCP setup** — `uv sync`, `playwright install firefox`, start server, run `get_addresses` to find home index
1. **Install SDK** — `npm install @modelcontextprotocol/sdk` in Eva
2. **`.env.local`** — add `BLINKIT_MCP_URL`, `BLINKIT_PHONE`, `BLINKIT_HOME_ADDRESS_INDEX`
3. **Supabase migration** — add `task_type`, `proposed_cart` columns; add `needs_otp` to status (check if enum or text)
4. **`inngest/client.ts`** — add `blinkit/otp.submitted` and `blinkit/order.approved` event types
5. **`lib/blinkit.ts`** — MCP SSE client wrapper: `createBlinkitClient`, `callTool`
6. **`lib/openai.ts`** — add `detectIntent()` function
7. **Update `Task` type in `TaskCard.tsx`** — add `needs_otp` status, optional `task_type`, `proposed_cart` fields
8. **Update `SwipeableTaskCard.tsx`** — same status/type changes as TaskCard
9. **`executeTask` (modified)** — intent detection + blinkit_order branch + OTP flow + search phase
10. **`inngest/placeBlinkitOrder.ts`** (new) — placement phase
11. **`/api/tasks/[id]/approve/route.ts`** (new)
12. **`/api/tasks/[id]/otp/route.ts`** (new)
13. **Update `/api/tasks/[id]/rerun/route.ts`** — clear `proposed_cart` on rerun
14. **`/api/inngest/route.ts`** — register `placeBlinkitOrder`
15. **`BlinkitCartPreview.tsx`** (new component)
16. **`OtpInput.tsx`** (new component)
17. **End-to-end test** — OTP login → search → cart approval → placement

---

## Resolved Questions

| Question | Resolution |
|---|---|
| COD support | Confirmed in source: `select_payment_method` tries Cash first |
| Search returns prices | Confirmed: `{ index, id, name, price }` per result |
| Session persistence | Confirmed: saved to `~/.blinkit_mcp/cookies/auth.json` |
| Home address index | Configure via `BLINKIT_HOME_ADDRESS_INDEX` env var after running `get_addresses` once |

## Remaining Unknowns

| Question | Impact |
|---|---|
| Is `status` column an enum or text in Supabase? | Determines migration needed for `needs_otp` |
| Blinkit delivery available at your address? | Must verify on first test run |

---

*Plan updated: May 2026 — all 15 gaps addressed*

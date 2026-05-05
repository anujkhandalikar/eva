# CLAUDE.md — Eva

## What is Eva

Eva is a personal productivity tool built to validate one idea: can background task execution free up deep focus? The builder captures a task via global hotkey, Eva executes it in the background, and results appear on a web dashboard for async review. V1 is a one-person validation build — not a market product.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | Next.js API routes |
| Database | Supabase (tasks table + real-time) |
| AI / Research | Gemini API (web research + summarisation + task parsing) |
| Desktop overlay | Electron (global hotkey capture) |
| Task queue | Inngest (background task execution) |
| Language | TypeScript throughout — no JavaScript files |

---

## Key Features

### P0 — Must work before anything else matters
- **Hotkey capture:** Electron registers a global hotkey. Overlay opens in < 500ms. User types task, hits Enter. Overlay closes. Task is sent to backend and queued.
- **Background execution:** Inngest job picks up the task, calls Gemini API for web research, summarisation, and task parsing. Result is trimmed to ≤ 100 words and written back to Supabase. Runs entirely without user involvement.
- **Web dashboard:** Single Next.js page at localhost:3000. Shows all tasks as cards in reverse chronological order. Each card: task name, 100-word summary, timestamp, status badge (Done / Needs Approval / Failed).
- **Approval gate:** Tasks that involve external actions show a confirm button on the dashboard card. Nothing executes without explicit approval.

### P1 — Builds on P0
- Failed task reason displayed on card
- Re-queue button on failed tasks

### P2 — Only after P0 and P1 are validated
- Voice capture via Electron
- Any integrations beyond research (bookings, orders)

---

## Data Model

```typescript
// Supabase: tasks table
type Task = {
  id: string                  // uuid
  created_at: string          // ISO timestamp
  input: string               // raw user input
  status: 'pending' | 'running' | 'done' | 'needs_approval' | 'failed'
  result_summary: string | null     // ≤ 100 words
  result_full: string | null        // full research output
  error_reason: string | null       // populated on failure
  requires_approval: boolean
  approved: boolean
}
```

---

## Project Structure

```
eva/
├── electron/
│   ├── main.ts               # Electron entry, global hotkey registration
│   └── overlay/              # Capture overlay UI
├── app/
│   ├── page.tsx              # Dashboard — task card list
│   ├── api/
│   │   ├── tasks/
│   │   │   ├── route.ts      # POST: create task, GET: list tasks
│   │   │   └── [id]/
│   │   │       └── approve/route.ts  # POST: approve action task
│   └── components/
│       ├── TaskCard.tsx
│       └── StatusBadge.tsx
├── inngest/
│   └── executeTask.ts        # Background job: Perplexity → Claude → Supabase update
├── lib/
│   ├── supabase.ts
│   └── gemini.ts             # web research + summarisation + task parsing
└── CLAUDE.md
```

---

## Coding Rules

- TypeScript everywhere. No `.js` files.
- No `any` types. Ever.
- All API calls wrapped in try/catch. Failures update the task status to `failed` with a reason — they never silently disappear.
- Async/await only — no `.then()` chains.
- No external UI component libraries. Tailwind only.
- No over-engineering. This is a validation build. Solve the problem in front of you, not the one three steps ahead.
- Every background job must update task status at the start (`running`) and end (`done` or `failed`). No orphaned `pending` tasks.
- Dashboard auto-refreshes via Supabase real-time subscription — no polling, no manual refresh.

---

## Design Rules

- Clean, minimal UI. No decorative elements that don't carry information.
- Dashboard is functional, not beautiful. Cards must be scannable in under 3 seconds.
- Status badges are colour-coded: green (Done), yellow (Needs Approval), red (Failed), grey (Pending/Running).
- Hotkey overlay is frameless, borderless, centred on screen. Disappears immediately after Enter.
- No modals. No popups. Approval happens inline on the card.

---

## What Eva Does NOT Do (v1)

- No mobile. Desktop only.
- No email or calendar access.
- No payment credentials or purchases.
- No multi-user. One person, one instance.
- No twice-daily briefing calls.
- No irreversible external actions without explicit dashboard approval.

---

## The One Thing That Must Work

Hotkey → task captured → Eva runs it → result on dashboard → user never had to think about it.

If that loop is broken, nothing else matters.

---

*Eva — Personal validation build — May 2026*
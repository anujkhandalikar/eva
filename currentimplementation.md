# Current Implementation — Eva

> High-level snapshot of what's actually in the code. Written before adding ordering capabilities.

---

## File Map

```
eva/
├── electron/
│   ├── main.ts                         # Electron entry; global hotkey (Ctrl double-tap); overlay window
│   └── overlay/
│       ├── index.html                  # Frameless 600×60 input overlay
│       └── renderer.ts                 # Enter → submit task via IPC; Escape → hide
├── app/
│   ├── page.tsx                        # Dashboard: fetches tasks, real-time subscription, view toggle
│   ├── layout.tsx                      # Root layout, font loading
│   ├── api/
│   │   ├── tasks/route.ts              # GET: list tasks (created_at DESC). POST: insert task + trigger Inngest
│   │   ├── tasks/[id]/route.ts         # DELETE: remove task
│   │   ├── tasks/[id]/rerun/route.ts   # POST: reset to pending, retrigger Inngest
│   │   └── inngest/route.ts            # Inngest webhook handler
│   └── components/
│       ├── TaskCard.tsx                # List-view task card
│       ├── SwipeableTaskCard.tsx       # Card-stack task card (draggable, swipe left=delete)
│       ├── CardStack.tsx               # Card deck: top 3 visible, swipe gestures, angles dropdown
│       ├── LLMDropdown.tsx             # "Explore angle" dropdown — opens Claude.ai with a canned prompt
│       └── ViewToggle.tsx              # Toggle between cards/list view
├── inngest/
│   ├── client.ts                       # Inngest client init
│   └── executeTask.ts                  # Background job: pending → running → done/failed
└── lib/
    ├── supabase.ts                     # Supabase client
    └── openai.ts                       # gpt-4o + web_search_preview → {summary, full_result, requires_approval}
```

---

## Data Model

```typescript
type Task = {
  id: string;
  created_at: string;
  input: string;
  status: 'pending' | 'running' | 'done' | 'needs_approval' | 'failed';
  result_summary: string | null;
  result_full: string | null;
  error_reason: string | null;
  requires_approval: boolean;
  approved: boolean;
};
```

Status lifecycle: `pending` → `running` → `done` | `needs_approval` | `failed`

---

## Data Flow

```
Ctrl double-tap
  → Electron shows 600×60 overlay
  → User types task + Enter
  → IPC: overlay → main.ts
  → POST /api/tasks  →  Supabase INSERT (status: pending)
                     →  Inngest event: task/created
  → Electron hides overlay

Inngest executeTask:
  1. Supabase UPDATE → status: running
  2. OpenAI gpt-4o + web_search_preview → {summary, full_result, requires_approval}
  3. Supabase UPDATE → status: done/needs_approval/failed

Supabase real-time pushes change to dashboard
  → React state update → card appears/updates
```

---

## Dashboard

- **Initial load:** `fetch('/api/tasks')` — all tasks, `created_at DESC`
- **Live updates:** Supabase real-time subscription on `tasks` table handles INSERT / UPDATE / DELETE
- **Two views:** card stack (`CardStack`) or list (`TaskCard`), toggled by `ViewToggle`
- **Card stack:** shows top 3 cards; swipe left = delete, swipe right = move to end; "angles" dropdown opens Claude.ai with a canned prompt (not model switching)
- **List view:** all cards in a scrollable column
- **Task actions:** rerun button (resets + retriggers), delete button, LLMDropdown

---

## What Works

| Feature | Status |
|---|---|
| Hotkey capture → API → Inngest | Working |
| Background execution (OpenAI research) | Working |
| Dashboard real-time updates | Working |
| Failed task reason on card | Working |
| Rerun button | Working |
| Delete task | Working |

## What Doesn't / Isn't Built

| Feature | Status |
|---|---|
| Approval execution | Flag exists, no backend action execution |
| Model switching | UI hint exists; hardcoded to `gpt-4o` |
| Task ordering / priority | Not implemented — this is what we're adding |
| View preference persistence | Not saved to localStorage |
| Task filtering / search | Not implemented |

---

## Tech Stack (Actual Versions)

| Layer | Tool |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Animation | Framer Motion 12 |
| Database | Supabase (PostgreSQL + Realtime) |
| LLM | OpenAI `gpt-4o` via `responses.create()` |
| Task queue | Inngest 4 (max 3 concurrent) |
| Desktop | Electron 28, `uiohook-napi` for global hotkey |

---

*Snapshot: May 2026 — pre-ordering feature*

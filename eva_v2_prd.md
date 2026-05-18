# Eva — Product Requirements Document (v2)

> *Personal capture-and-execution OS for a founder in deep work.*
> *Updated: May 2026 — post-validation, adding surface polish and integrations.*

---

## 1. What Eva Is Now

Eva started as a question: does background task execution actually free up focus? The hotkey → background execution → async review loop is **validated**. The v1 loop works. Eva is now in a second phase: expanding the *types* of things it captures and executes, and refining the *surface* (the notch overlay) from a functional prototype to something that feels native.

This PRD captures both what's built and what's next. It supersedes `eva_v1_prd.md`.

---

## 2. The Problem — Still True, Sharper Now

Every stray thought or task during deep work forces a choice: act now (lose focus) or defer (lose the thing). No tool handles both capture and execution without demanding attention in return.

Three insight expansions since v1:

1. **Not everything is a task.** Half of what surfaces is a thought — an idea, observation, follow-up note. Forcing a thought through the task executor was wrong. Thoughts need capture without execution.
2. **The surface matters as much as the back-end.** An overlay that looks generic breaks the "part of the OS" illusion. The notch is the right anchor — it's always there, it's trusted, it's invisible until needed.
3. **Context is part of the task.** Screenshots, images, and visual context are how a lot of real work begins. The capture surface needs to accept them.

---

## 3. Success Metrics (still personal, still feel-based)

**Primary:** Did Eva complete the task correctly, and did I not have to think about it while it ran?

**Secondary (now tracked weekly):**
- Daily capture count: ≥ 20 inputs/day (tasks + thoughts combined). Below 5 = not in muscle memory.
- Classifier accuracy: % of inputs user reclassifies. Target < 5%. Above 10% = retune prompt.
- Promotion rate: % of thoughts promoted to tasks within 7 days. Target 5–15%.
- Overlay open time: median < 1.5s (input → dismiss). Above 3s = the surface is getting in the way.

---

## 4. User & Job-to-be-Done

**User: The builder themselves.** Knowledge worker, 2–4 hour deep work blocks, running Eva on a notched MacBook, frequently context-switching between desk and phone.

**Jobs hired for:**

| Situation | Job |
|---|---|
| Mid deep-work, stray task surfaces | *"Take this off my plate so I stay in what I'm doing"* |
| Fleeting idea, not worth executing | *"Get this out of my head before it's gone"* |
| Away from desk | *"Capture from phone, same stream"* |
| Visual context needed | *"Send this screenshot + query, Eva figures it out"* |
| Wants to check status without breaking flow | *"Tell me what's happening without making me open anything"* |

---

## 5. Surfaces

### 5.1 Notch Overlay (Primary — Desktop)

The overlay is a macOS notch extension. It lives in the menu bar as a small ambient indicator and expands on interaction. It is the face of Eva.

**Ambient state (always visible):**
- A 7px dot sits just outside the physical notch, to the right of center.
- Dot colour encodes the most recent task's status: white-pulse (pending/captured) → yellow-pulse (running) → green (done) → orange-pulse (needs approval) → red (failed).
- Window height = menu bar height. The pill's bottom edge is flush with the notch bottom.
- Zero interaction needed; zero distraction.

**Open state (hover or Ctrl tap):**
- Triggered by: cursor entering the notch zone (150ms debounce, no focus steal) OR single Ctrl tap (steals focus so user can type immediately).
- Window animates from menu-bar height to 68px + task panel.
- Pill has outward-turning corners at the top (radial gradient mask) that blend seamlessly with the screen edge above the notch.
- Animation: cubic-bezier(0.22, 1, 0.36, 1), 220ms. Same easing as iOS spring animations.

**Collapse:**
- On Ctrl tap when open → collapses immediately.
- On cursor leaving the window rect (200ms debounce) → collapses. Exception: if opened via Ctrl, hover-leave does not collapse — user is in control.
- On blur (another app gains focus) → collapses.
- On task submit (Enter) → brief confirm animation ("✓ Captured" tick), then collapses.

**Pill input:**
- Single-line text input, SF Pro, 15px, bold, caret red (`#dc2626`).
- Placeholder: `Capture anything…`
- Enter → submit task. Escape → collapse without submitting.
- Pill width auto-expands as user types (measured via hidden span), up to max pill width.
- Image chip: thumbnail shown in input row when a screenshot is attached.
- Screenshot button: captures the active display via Electron `desktopCapturer`, returns PNG buffer, attaches as image chip. In-flight: button dims, non-interactive.
- Drag-and-drop: dropping an image file onto the pill attaches it as a chip.

**Expanded task panel (below input):**
- Two-tab switcher: **Tasks** (default) / **Thoughts**.
- Tab persists across overlay open/close within a session; resets to Tasks on Eva restart.
- Tasks tab: status-dot list, urgency-sorted, last 20, click → dashboard at that entry.
- Thoughts tab: recency-sorted, no status dot, last 10 + "… more on dashboard" footer.
- Thin scrollbar (3px, rgba white).
- Badge on browse button: red dot counting `needs_approval` + `failed` tasks. Pulses when > 0.

**Text trigger shortcuts (in input):**
- Typing `text [contact name]` prefills a WhatsApp intent and resolves the contact name against the known contacts list, confirming with an inline chip before submission.
- Typing `/clear done`, `/clear failed`, `/clear pending`, `/clear thoughts` → bulk deletes that category. Confirm via toast: "Cleared N items."
- These shortcuts are recognized at submit time; no UI mode switch.

### 5.2 Mobile / Web Entry Sheet

- FAB at bottom of dashboard (`/`).
- Plain text entry, submit button.
- Token-gated: `x-submit-token` header, token stored in `localStorage`.
- Same backend API as Electron overlay — identical task creation flow.
- No image attachment in v2 (mobile upload deferred to v3).

### 5.3 Dashboard (Web, `localhost:3000`)

The async review surface. Opens in browser via overlay "browse" button or direct URL.

**Stream:**
- Reverse chronological, real-time via Supabase subscription (INSERT / UPDATE / DELETE).
- Two card types rendered in the same stream: Task cards, Thought cards.

**Filter bar (above stream):**
- Toggle: All · Tasks · Thoughts.
- Tag filter pills (only show tags present in current dataset).
- Substring search on `input` field.
- View toggle: card stack / list.

**Task card:**
- Input text, status badge, result summary (≤ 100 words, markdown stripped), timestamp, first link as button, error reason on failure.
- Inline actions: Approve, Rerun, Cancel, Reclassify (task → thought), Edit.
- WhatsApp send cards: recipient name + number, message body, Cancel + Send Message buttons.
- Calendar tasks: "✓ Passed to Claude" + "Open in Claude →" button.
- Low-confidence flag: if classifier confidence < 0.6, ghost affordance "Eva wasn't sure — is this a task?" → single click to flip.

**Thought card:**
- Body text (full input, wraps to ~3 lines, expand on click).
- Timestamp (relative: "2h ago").
- Tag chips.
- Left border accent (dotted grey) for visual differentiation from task cards.
- Actions on hover: Promote to task · Edit · Delete · Wrong tag?
- No status badge, no spinner, no approval button.

---

## 6. Capture & Classification Flow

```
hotkey / mobile / drag-drop
         │
         ▼
POST /api/tasks  { input, image? }
         │
         ▼
Supabase INSERT (status: pending, entry_type: null)
         │
         ▼
Inngest: execute-task
         │
         ├── Step 1: classify-entry  (gpt-4o-mini, JSON mode)
         │     → { entry_type: 'thought'|'task', tags: [], confidence: 0–1 }
         │     → Supabase UPDATE: entry_type, tags, classification_confidence
         │
         ├── if thought → UPDATE status='captured' → DONE
         │
         └── if task → Step 2: detect-intent
                   → { task_type: 'research'|'calendar'|'whatsapp'|'blinkit' }
                   → route to handler
```

**Classifier rules:**
- Imperative verb at start (find, book, send, order, schedule, summarize, check) → task.
- Past tense, declarative, self-directed, observation → thought.
- When ambiguous, prefer thought — user can promote later.
- Fixed tag vocabulary: `product · personal · idea · followup · gripe · person · decision · question · reference`
- Multi-tag allowed. Unknown tags silently dropped.
- Fallback on classifier failure: treat as task (research path is graceful; orphaned rows are worse).

---

## 7. Execution Routes

| Intent | Executor | Approval Gate |
|---|---|---|
| Web research | OpenAI `gpt-4o` + `web_search_preview` | None — read-only |
| WhatsApp send | WhatsApp MCP bridge (lharries/whatsapp-mcp) | `needs_approval` → `/api/tasks/[id]/whatsapp-approve` |
| WhatsApp read | WhatsApp MCP bridge | None — read-only |
| Blinkit order | Blinkit MCP server (SSE) | `needs_approval` → `/api/tasks/[id]/approve`; `needs_otp` → `/api/tasks/[id]/otp` |
| Calendar create/read | Claude.ai handoff (pre-filled URL) | None — handoff only |
| Calendar update/delete | Google Calendar API (direct) | `needs_approval` → `/api/tasks/[id]/calendar-approve` |
| Thought | None | None |

**WhatsApp contact resolution:**
- Overlay text trigger: `text [name]` → inline chip shows resolved contact before submit.
- Resolved via `search_contacts` MCP tool at classify time.
- Drafts stored in `proposed_message` (jsonb): `{ recipient, recipient_name, body }`.
- Approval card shows full name + number before send. No re-generation at approval time.

**Image + screenshot tasks:**
- If image is attached and entry_type resolves to thought → stored as `entry_type='thought'` with image URL, `status='captured'`.
- If entry_type resolves to task → image passed to OpenAI vision model alongside text input for research/analysis.

---

## 8. Data Model

```typescript
type Entry = {
  id: string                          // uuid
  created_at: string                  // ISO 8601

  // Capture
  input: string                       // raw user input
  image_url: string | null            // Supabase Storage URL if image attached

  // Classification
  entry_type: 'thought' | 'task'
  tags: string[]                      // thought only; [] for tasks
  classification_confidence: number | null

  // Task execution
  status: 'captured'                  // thought terminal state
         | 'pending'                  // queued
         | 'running'                  // Inngest job active
         | 'done'                     // completed
         | 'needs_approval'           // external action waiting
         | 'needs_otp'               // Blinkit OTP gate
         | 'failed'                   // error, see error_reason

  task_type: 'research' | 'calendar' | 'whatsapp' | 'blinkit' | null

  // Results
  result_summary: string | null       // ≤ 100 words, markdown stripped
  result_full: string | null          // full output
  error_reason: string | null

  // Approval
  requires_approval: boolean
  approved: boolean
  proposed_message: {                 // whatsapp send only
    recipient: string
    recipient_name: string
    body: string
  } | null
  claude_url: string | null          // calendar handoff URL

  // Thought linkage
  promoted_to_task_id: string | null  // FK → tasks.id ON DELETE SET NULL
}
```

**Status lifecycle:**
```
captured  (terminal — thought)

pending → running → done
                  ↘ failed
                  ↘ needs_approval → approve → running → done
                                   ↘ cancel  → done ("Cancelled by user")
                  ↘ needs_otp     → otp     → running → done
```

---

## 9. User Stories

| As the builder, I want to… | So that… | Priority |
|---|---|---|
| Capture a task via global hotkey in under 5 seconds | I don't break focus | P0 |
| Capture a thought without it being executed | I keep ideas without triaging in the moment | P0 |
| Have Eva classify task vs. thought automatically | I never pick a mode | P0 |
| Have Eva research a topic and return a plain summary | I get the answer without browsing | P0 |
| Attach a screenshot to a query with one button press | I give Eva visual context without leaving the overlay | P0 |
| See ambient task status in the notch without opening anything | I know it's done without context switching | P0 |
| See tasks and thoughts in separate tabs in the overlay | I can glance at recent captures by type | P0 |
| Reclassify a misfiled task as a thought (and vice versa) | Wrong classifications don't trigger unintended work | P0 |
| Promote a thought to a task with one click | "Look into X" turns into actual research without re-typing | P0 |
| Have Eva send a WhatsApp message after I approve | I delegate messages without opening the app | P0 |
| Type "text [name]" in the overlay and have Eva resolve the contact | I address messages conversationally | P0 |
| Have Eva build a Blinkit cart and place an order after OTP | I order groceries without the manual flow | P0 |
| Hand off calendar tasks to Claude with one click | I manage schedule conversationally | P0 |
| Capture from my phone | I can delegate when away from desk | P0 |
| Cancel a task waiting on approval | I can change my mind before it fires | P0 |
| See why a task failed and re-queue it | I don't lose tasks that didn't complete | P1 |
| Filter the dashboard by thoughts, tasks, or tags | I can find what I'm looking for in the stream | P1 |
| Edit a thought's text inline | Typo fixes don't require delete + re-capture | P1 |
| Bulk-clear done / failed / thought entries from the overlay | I can tidy the stream without opening the dashboard | P1 |
| Capture tasks by voice (hotkey hold) | I can delegate while my hands are busy | P2 |

---

## 10. Acceptance Criteria

### Overlay
- [x] Hotkey opens capture overlay in < 500ms on macOS
- [x] Overlay animates into notch with spring easing; collapses back cleanly
- [x] Outward-turning corner mask blends pill top edge with screen edge above notch
- [x] Ambient status dot reflects most-recent task status without overlay open
- [x] Screenshot button captures active display, attaches as image chip in input row
- [x] Drag-and-drop image onto pill attaches as chip
- [x] Task submit closes overlay and shows "✓ Captured" confirmation in notch
- [x] Tasks tab shows status-dot list, urgency-sorted
- [x] Thoughts tab shows recency-sorted list, no status dots
- [x] Tab selection persists within session
- [x] Badge on browse button counts needs_approval + failed, pulses when > 0
- [x] `/clear done|failed|pending|thoughts` commands work from overlay input
- [ ] `text [name]` trigger resolves contact inline before submit (P0 — in progress)
- [ ] Overlay input expands pill width dynamically as user types

### Capture & Classification
- [x] Task is logged and execution begins within 5 seconds of submission
- [x] Thoughts are classified automatically, stored as `entry_type='thought'`, no Inngest job run
- [x] Classifier fallback on error: treat as task, never drop the row
- [x] `classification_confidence` stored; < 0.6 shows affordance on dashboard card
- [ ] Image attached to task is passed to OpenAI vision for analysis (P0 — in progress)

### Execution
- [x] Research tasks return a result in < 5 minutes; summary ≤ 100 words
- [x] No external action executes without explicit dashboard approval
- [x] WhatsApp send: proposed message stored at classify time; approval card shows name + number
- [x] Blinkit: `needs_approval` and `needs_otp` gates work
- [x] Calendar: Claude handoff URL generated; "Open in Claude →" button on card
- [x] Failed tasks show reason and re-queue option
- [x] Dashboard updates without manual refresh (Supabase real-time)

### Dashboard
- [x] Thoughts and tasks shown in same stream, visually differentiated (dotted left border on thoughts)
- [x] Filter bar: All / Tasks / Thoughts toggle; tag pills; substring search
- [x] Misclassified tasks can be reclassified; thoughts can be promoted to tasks
- [x] Reclassify blocked when task status is `running` or `needs_approval`
- [x] Promote creates a new task row, links it via `promoted_to_task_id`, keeps source thought
- [x] Mobile entry sheet is token-gated and works in a phone browser
- [ ] Edit thought text inline (P1)
- [ ] Voice capture: hotkey hold → Whisper transcription (P2)

---

## 11. What's Out of Scope (v2)

- Voice capture (P2 — spec exists, not built)
- Native mobile app (mobile is web-only)
- Email integration
- Stored payment credentials (Blinkit auth remains OTP per-order)
- Multi-user / multi-tenant
- Client-side encryption for thoughts (flagged for v3)
- Embeddings / semantic search across thoughts (flagged for v3)
- Daily/weekly digest emails
- Twice-daily briefing calls
- WhatsApp audio messages (FFmpeg dep, P2)

---

## 12. Technical Stack (Actual)

| Layer | Tool | Version |
|---|---|---|
| Frontend | Next.js + React | 16 / 19 |
| Styling | Tailwind CSS | 4 |
| Animation | Framer Motion | 12 |
| Database | Supabase (PostgreSQL + Realtime) | — |
| LLM — Research | OpenAI `gpt-4o` + `web_search_preview` | responses API |
| LLM — Classify | OpenAI `gpt-4o-mini` | JSON mode |
| LLM — Calendar | Claude.ai (handoff via URL) | — |
| Task queue | Inngest | 4 (max 3 concurrent) |
| Desktop | Electron | 28 |
| Global hotkey | `uiohook-napi` | — |
| WhatsApp | lharries/whatsapp-mcp (Go bridge + Python MCP server) | — |
| Blinkit | Blinkit MCP server (SSE) | — |
| Screen capture | Electron `desktopCapturer` API | — |

---

## 13. Architecture — Key Files

```
eva/
├── electron/
│   ├── main.ts                        # Hotkey, notch animation, IPC, screenshot
│   └── overlay/
│       ├── index.html                 # Pill UI, tabs, chips, ambient dot
│       └── renderer.ts                # Input handling, task/thought rendering, triggers
├── app/
│   ├── page.tsx                       # Dashboard: stream, filter bar, real-time
│   ├── api/
│   │   ├── tasks/route.ts             # GET/POST/DELETE (with entry_type filter)
│   │   ├── tasks/[id]/route.ts        # DELETE single
│   │   ├── tasks/[id]/rerun/route.ts  # POST: reset + retrigger
│   │   ├── tasks/[id]/approve/route.ts
│   │   ├── tasks/[id]/whatsapp-approve/route.ts
│   │   ├── tasks/[id]/calendar-approve/route.ts
│   │   ├── tasks/[id]/otp/route.ts
│   │   ├── tasks/[id]/promote/route.ts   # POST: thought → task
│   │   ├── tasks/[id]/reclassify/route.ts
│   │   └── inngest/route.ts
│   └── components/
│       ├── TaskCard.tsx
│       ├── ThoughtCard.tsx
│       ├── FilterBar.tsx
│       ├── SwipeableTaskCard.tsx
│       ├── CardStack.tsx
│       ├── LLMDropdown.tsx
│       └── ViewToggle.tsx
├── inngest/
│   ├── client.ts
│   └── executeTask.ts                 # classify-entry → detect-intent → route
├── lib/
│   ├── supabase.ts
│   ├── openai.ts                      # classifyEntry + research executor
│   └── router.ts                      # detectIntent: task_type routing
└── start.sh                           # Starts WA bridge + Eva together
```

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Classifier wrong too often | Fixed tag vocab, few-shot examples, low-confidence affordance, easy reclassify |
| Thought stream becomes overwhelming | Filters (Phase 3). If still bad: time-bucketing (Today / This Week / Older) |
| WhatsApp session expires (~20 days) | Surfaced as task `failed` with clear re-auth message |
| Wrong WhatsApp recipient resolved | Approval card shows full name + number before send; always human-in-loop |
| desktopCapturer blocked by macOS | Screen Recording permission required; prompted on first launch |
| Overlay mis-positions after Mission Control / Space switch | Re-asserted `setAlwaysOnTop(screen-saver)` + `setVisibleOnAllWorkspaces` on every show |
| Inngest rate limit (Gemini / OpenAI) | Exponential backoff in step retry; task marked `failed` with reason on hard limit |
| Blinkit OTP flow breaks | Approval card shows OTP input; separate `/otp` endpoint handles it |

---

*Eva v2 PRD — Builder validation, phase 2 — May 2026*

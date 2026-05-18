# Eva — Product Requirements Document (v1 / Personal Validation)

---

## 1. Strategic Context

Eva is a personal tool built to answer one question: does background task execution actually free up focus, or is it just a nice idea? V1 is not a market product — it is a working prototype used by one person to validate the core loop before anything else is decided.

The hotkey → background execution → async review loop is now validated. Integrations (WhatsApp, Blinkit, Google Calendar) and thought capture are now in scope as natural extensions of that loop.

---

## 2. Problem

Every time a stray task surfaces during deep work — research, orders, lookups, messages, calendar shuffles — the options are: act on it now (lose focus) or write it down and forget it (lose the task). No tool currently captures the task AND handles it without demanding attention in return.

A related problem: not every stray surface is a task. Some are thoughts — half-formed ideas worth keeping but not worth executing. They deserve capture without forcing the user to triage in the moment.

---

## 3. Success Metric

One question only: **Did Eva complete the task correctly, and did I not have to think about it while it ran?**

Tracked manually by the builder after each task. No dashboard analytics, no retention KPIs. This is a feel test, not a data test.

---

## 4. User & Job-to-be-Done

**User: The builder themselves.**
- Context: Knowledge worker, deep work blocks of 2–4 hours, frequent stray tasks surfacing mid-flow, often away from desk on phone
- Job hired for: *"Take this task off my plate right now so I can stay in what I'm doing — whether I'm at my desk or not."*

---

## 5. Solution

### Core Flow

1. **Capture** — From desktop (global hotkey overlay) or mobile (web entry sheet). User submits text. Surface closes immediately. Zero context switch.
2. **Classify** — Eva uses gpt-4o-mini to decide whether the input is a **task** (something to execute) or a **thought** (something to keep). Tasks are routed to executors; thoughts are stored with tags.
3. **Execute** — Tasks run in the background via Inngest jobs. Eva detects intent and dispatches: web research, WhatsApp send, Blinkit order, or calendar action. External actions stop at `needs_approval`.
4. **Deliver** — Result is posted to the Eva dashboard. Ambient status dot on the desktop overlay reflects the most recent task without requiring a window.
5. **Review** — Dashboard shows cards in reverse chronological order, filterable by tasks vs thoughts. User approves any action before it fires. Misclassified tasks can be reclassified to thoughts in place.

### Capture Surfaces

| Surface | Trigger | Auth |
|---|---|---|
| Desktop overlay (Electron) | Double-Ctrl global hotkey | Local only |
| Mobile / web entry sheet | FAB on dashboard `/` route | Token-gated via `x-submit-token` header, stored in `localStorage` |
| Ambient status dot | Always visible on overlay; expands to pill on input | Local only |

### Execution Routes

| Intent | Executor | Approval Gate |
|---|---|---|
| Web research | OpenAI `gpt-4o-mini` + `web_search_preview` | None — read-only |
| WhatsApp send | Local WhatsApp MCP bridge | `needs_approval` → `/api/tasks/[id]/whatsapp-approve` |
| WhatsApp read | Local WhatsApp MCP bridge | None — read-only |
| Blinkit order | Blinkit MCP server (SSE) | `needs_approval` → `/api/tasks/[id]/approve`; `needs_otp` → `/api/tasks/[id]/otp` |
| Calendar list / create | Google Calendar API | None |
| Calendar update / delete | Google Calendar API | `needs_approval` → `/api/tasks/[id]/calendar-approve` |
| Thought | None (stored only) | None |

### Dashboard

- Single page at `/`. Cards in reverse chronological order, real-time via Supabase subscription.
- Filter bar: All / Tasks / Thoughts. Tag filter for thoughts.
- Card content: input, status badge, summary (≤ 100 words, markdown stripped), timestamp, first link as button, error reason on failure.
- Inline actions per card: Approve, Rerun, Cancel, Reclassify (task → thought), Promote (thought → task), Edit tags.
- Dark mode with theme toggle and persistence.
- View toggle: card stack vs list.

### Status Lifecycle

```
captured → pending → running → done
                              ↘ failed
                              ↘ needs_approval → approve → running → done
                                              ↘ cancel → done ("Cancelled by user")
                              ↘ needs_otp → otp → running → done
```

---

## 6. User Stories

| As a... | I want to... | So that... | Priority |
|---|---|---|---|
| Builder | Capture a task via global hotkey in under 5 seconds | I don't break focus | P0 |
| Builder | Capture a task from my phone | I can delegate when away from desk | P0 |
| Builder | Have Eva research a topic and return a plain summary | I get the answer without browsing myself | P0 |
| Builder | Capture a half-formed thought without it being executed | I keep ideas without triaging in the moment | P0 |
| Builder | Reclassify a misfired task as a thought | Wrong classifications don't trigger work | P0 |
| Builder | Have Eva send a WhatsApp message to a contact after I approve | I delegate messages without opening the app | P0 |
| Builder | Have Eva build a Blinkit cart and place an order after I approve and submit OTP | I order groceries without the manual flow | P0 |
| Builder | Have Eva create / update / delete calendar events after I approve mutations | I manage my schedule conversationally | P0 |
| Builder | See ambient task status on the desktop overlay without opening the dashboard | I know it's done without context switching | P0 |
| Builder | Cancel a task waiting on approval | I can change my mind before it fires | P0 |
| Builder | See why a task failed and re-queue it | I don't lose tasks that didn't complete | P1 |
| Builder | Capture tasks by voice without touching the keyboard | I can delegate while my hands are busy | P2 |

---

## 7. Acceptance Criteria

- [x] Hotkey opens capture overlay in < 500ms on macOS
- [x] Task is logged and execution begins within 5 seconds of submission
- [x] Research tasks return a result in < 5 minutes
- [x] Result summary is ≤ 100 words on the card view; markdown stripped
- [x] No external action (WhatsApp send, Blinkit order, calendar mutation) executes without explicit dashboard approval
- [x] Failed tasks show a reason and a re-queue option
- [x] Dashboard updates without manual refresh (Supabase real-time)
- [x] Thoughts and tasks are classified automatically and shown in separate filters
- [x] Misclassified tasks can be reclassified to thoughts; thoughts can be promoted to tasks
- [x] Mobile entry sheet is token-gated and works on a phone browser
- [x] Ambient status dot on overlay reflects the most recent task's state
- [x] Tasks in `needs_approval` can be cancelled
- [ ] Voice capture: hotkey-press-and-hold transcribes via Whisper (P2)

---

## Out of Scope (v1)

- Voice capture (P2 — planned, not built)
- Twice-daily briefing calls
- Native mobile app (mobile is web-only via entry sheet)
- Email integration
- Stored payment credentials (Blinkit auth is OTP per-order)
- Multi-user / multi-tenant features
- Irreversible external actions without explicit dashboard approval

---

*Eva v1 PRD — Personal validation build — May 2026*

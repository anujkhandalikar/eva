# Eva — Product Requirements Document (v1 / Personal Validation)

---

## 1. Strategic Context

Eva is a personal tool built to answer one question: does background task execution actually free up focus, or is it just a nice idea? V1 is not a market product. It is a working prototype used by one person to validate the core loop before anything else is decided.

---

## 2. Problem

Every time a stray task surfaces during deep work — research, orders, lookups — the options are: act on it now (lose focus) or write it down and forget it (lose the task). No tool currently captures the task AND handles it without demanding attention in return.

---

## 3. Success Metric

One question only: **Did Eva complete the task correctly, and did I not have to think about it while it ran?**

Tracked manually by the builder after each task. No dashboard analytics, no retention KPIs. This is a feel test, not a data test.

---

## 4. User & Job-to-be-Done

**User: The builder themselves.**
- Context: Knowledge worker, deep work blocks of 2–4 hours, frequent stray tasks surfacing mid-flow
- Job hired for: *"Take this task off my plate right now so I can stay in what I'm doing."*

---

## 5. Solution

### Core Flow

1. **Capture** — User presses global hotkey on desktop. A 1-line overlay appears. User types the task. Overlay closes in 3 seconds. Zero context switch.
2. **Execute** — Eva runs the task in the background using Perplexity-style web research and summarisation. No deep research. Moderate quality — good enough to act on. Use free gemini for research 
3. **Deliver** — Result is posted to the Eva web dashboard. User opens it when their focus block ends.
4. **Review** — Dashboard shows task cards: task name, result summary (≤ 100 words), status (Done / Needs Approval / Failed). User approves any action-based task before it executes.

### Key Interactions

- **Hotkey capture:** Global shortcut opens a 1-line overlay. Submits on Enter. Closes immediately.
- **Web dashboard:** Single page. Cards in reverse chronological order. Each card shows task, summary, timestamp, status. Expandable for full detail.
- **Approval gate:** Tasks involving external actions (bookings, orders) show a confirm button on the dashboard. Nothing executes without it.

---

## 6. User Stories

| As a... | I want to... | So that... | Priority |
|---|---|---|---|
| Builder | Capture a task via hotkey in under 5 seconds | I don't break focus | P0 |
| Builder | Have Eva research a topic and return a plain summary | I get the answer without browsing myself | P0 |
| Builder | See all completed tasks on a web dashboard | I review results when I choose to | P0 |
| Builder | Approve any external action before it fires | Nothing irreversible happens without my say | P0 |
| Builder | See why a task failed and re-queue it | I don't lose tasks that didn't complete | P1 |
| Builder | Capture tasks by voice without touching the keyboard | I can delegate while away from the screen | P2 |

---

## 7. Acceptance Criteria

- [ ] Hotkey opens capture overlay in < 500ms on desktop (Mac first, Windows later)
- [ ] Task is logged and execution begins within 5 seconds of submission
- [ ] Research tasks return a result in < 5 minutes
- [ ] Result summary is ≤ 100 words on the card view
- [ ] No external action executes without explicit dashboard approval
- [ ] Failed tasks show a reason and a re-queue option
- [ ] Dashboard loads and shows latest tasks without requiring a page refresh

---

## Out of Scope (v1)

- Voice capture (P2 — ships only if hotkey flow is validated first)
- Mobile app
- Twice-daily briefing calls
- Email and calendar integration
- Multi-user features
- Payment credentials of any kind

---

*Eva v1 PRD — Personal validation build — May 2026*

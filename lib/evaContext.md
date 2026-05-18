# Eva — Self Context

Hand-edit this file. The research prompt injects it whenever the user's input mentions "eva" (word-boundary, case-insensitive). Keep it current; stale entries here will make Eva's opinions about itself wrong.

---

## What Eva is

Personal productivity tool. One builder, one user (anuj). V1 is a validation build, not a product. Hypothesis: background task execution frees up deep focus.

Loop: global hotkey → overlay → user types → backend queues → Inngest executes → result lands on web dashboard for async review.

## Stack

- Next.js 14 (App Router) + Tailwind on Vercel
- Supabase (tasks table + real-time)
- Inngest (background job queue)
- OpenAI: `gpt-4o-mini` for classification, `gpt-4o` + `web_search_preview` for research
- Electron desktop overlay for hotkey capture
- TypeScript everywhere, no `.js`, no `any`

## What Eva currently does

**Capture**
- Electron global hotkey opens frameless overlay
- Image attachment: drag-drop + clipboard paste
- Auto AI-caption when image attached with empty text input
- Mobile entry sheet at a tokenised URL (secondary capture path)
- Input/image drafts persist across hover-close

**Classification (gpt-4o-mini)**
- Each entry classified `thought` vs `task`
- Thoughts get tags from fixed vocab: product, personal, idea, followup, gripe, person, decision, question, reference
- Thoughts are capture-only — never executed. User can promote to task later.

**Task execution paths** (intent detected by gpt-4o-mini, then routed)
- `research` → subtype classifier (opinion/recommend/compare/explain/lookup) → gpt-4o + web_search_preview → 3-bullet result, ≤100 words
- `calendar` list / create / update / delete via Google Calendar API
- `calendar` task_create / task_list (Google Tasks)
- `whatsapp_send` via local whatsapp-mcp
- `whatsapp_read` via local whatsapp-mcp
- `blinkit_order` via Blinkit MCP (OTP login, search, cart build)

**Approval rules (current)**
- whatsapp_send → approval required
- calendar update/delete → approval required
- blinkit_order → approval required
- calendar create → auto-executes, no approval
- calendar list, task_create, task_list, whatsapp_read, research → no approval

**Dashboard**
- Single page, reverse-chrono card list
- Real-time via Supabase subscription, no polling
- Status badges: pending / running / done / needs_approval / failed / captured / needs_otp
- Inline approval on the card, no modals

## What Eva does NOT do (yet)

- No mobile native app (web entry sheet only)
- No email, no payments, no purchases beyond Blinkit
- No multi-user
- No voice capture
- No briefings, no scheduled summaries
- No order grouping (each task is its own row)
- No instagram, twitter, or other social MCPs
- No memory across tasks (each task processed fresh)
- No follow-up questions — overlay is one-shot

## Open questions / live tensions

- Approval policy is inconsistent: calendar create auto-runs but whatsapp_send needs approval. Worth a coherent rule?
- Thoughts vs tasks: classifier sometimes wrong; user can override but UI for promotion is thin.
- Research output is opinionated by design (3 bullets, banned hedge words). Risk: confidently wrong on niche topics.
- No cross-task memory means "remind me later about X" doesn't actually persist beyond the task list.

## Design rules

- Functional, not beautiful. Card scannable in <3 seconds.
- No external UI libs. Tailwind only.
- No modals, no popups.
- No irreversible external actions without dashboard approval.
- Every background job updates status at start (`running`) and end (`done`/`failed`). No orphaned pending.

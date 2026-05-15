# Thought Capture — Spec & Implementation Plan

**Owner:** Anuj
**Status:** Draft v1
**Date:** 2026-05-15
**Builds on:** existing `tasks` table + Inngest `executeTask` intent router

---

## 1. Problem

An operator-founder runs through 50–100 micro-thoughts per day: ideas, gripes, follow-ups, reminders. Today those land in Apple Notes, Slack-DM-to-self, paper, or nowhere. None of those surfaces are <500ms to reach, and none are searchable later.

Eva already owns the <500ms hotkey surface. Right now every input is treated as an executable task — which forces the user to phrase thoughts as commands, or skip Eva entirely. That's the gap.

## 2. Goal

**Eva becomes the single hotkey for "get it out of my head."**

Two job types, same input box, no UI toggle:
- **Capture** — fleeting thought. No execution. Stored, tagged, retrievable.
- **Execute** — research / calendar / order / message. Eva runs.

Classification happens server-side. User never picks a mode.

## 3. Non-Goals (v1)

- No thought → task auto-promotion (manual button only).
- No NLP search across thoughts beyond keyword/tag filter.
- No daily/weekly digest emails.
- No voice capture (P2, separate spec).
- No mobile/cross-device capture.
- No encryption-at-rest beyond Supabase defaults.

## 4. User Stories

| # | As an operator-founder, I want to… | So that… |
|---|---|---|
| US-1 | type a fleeting idea into the overlay and dismiss it in <1s | I don't lose it but don't break flow |
| US-2 | not have to pick "thought vs task" — Eva figures it out | I never think about Eva, only through it |
| US-3 | scroll a reverse-chron stream of my thoughts on the dashboard | I can review my own mind at end of day |
| US-4 | filter thoughts by auto-applied tag (`product`, `personal`, `idea`, `followup`, `gripe`) | I can find the 3 product thoughts from last Tuesday |
| US-5 | promote a thought to a task with one click | a "look into X" thought turns into actual research without re-typing |
| US-6 | edit or delete a thought card | typos, dupes, and outdated notes don't pollute the stream |
| US-7 | correct Eva when classification is wrong | one wrong call doesn't poison the data |

## 5. Data Model

### 5.1 Schema changes to `tasks`

Reuse the table — thoughts are first-class rows, not a second table. One stream, one query.

```sql
ALTER TABLE tasks
  ADD COLUMN entry_type text NOT NULL DEFAULT 'task'
    CHECK (entry_type IN ('thought', 'task')),
  ADD COLUMN tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN promoted_to_task_id uuid REFERENCES tasks(id) ON DELETE SET NULL,
  ADD COLUMN classification_confidence real;

CREATE INDEX idx_tasks_entry_type ON tasks(entry_type);
CREATE INDEX idx_tasks_tags ON tasks USING GIN (tags);
```

Notes:
- `entry_type='thought'` rows have `status='captured'` and no `result_*`, no `task_type`, no approval fields populated.
- Add `'captured'` to the application-level status union; DB `status` column is already `text` (no check constraint to alter — verify in `supabase_migration.sql`).
- `promoted_to_task_id` links a thought to the task it spawned. Audit trail, not a hard FK requirement.
- `classification_confidence` (0–1) lets us surface "Eva wasn't sure" and lets us tune the classifier later.

### 5.2 TypeScript type

```typescript
export type Entry = {
  id: string
  created_at: string
  input: string
  entry_type: 'thought' | 'task'
  status: 'captured' | 'pending' | 'running' | 'done' | 'needs_approval' | 'failed' | 'needs_otp'
  tags: string[]
  classification_confidence: number | null
  promoted_to_task_id: string | null
  // existing task fields (result_summary, task_type, etc.) — null for thoughts
}
```

### 5.3 Tag vocabulary (constrained)

LLM must pick from a fixed set; no free-form. Prevents tag explosion.

```
product · personal · idea · followup · gripe · person · decision · question · reference
```

Multi-tag allowed. Zero tags allowed (default empty array).

## 6. Architecture / Flow

### 6.1 Capture flow

```
hotkey → overlay → POST /api/tasks  { input }
                       │
                       ▼
               Insert row, status='pending', entry_type=NULL
                       │
                       ▼
               inngest.send('task/created')
                       │
                       ▼
               executeTask (Inngest)
                       │
                       ▼
         classifyEntry(input)  ← NEW step, runs BEFORE detectIntent
                       │
              ┌────────┴────────┐
              ▼                 ▼
         thought              task
              │                 │
   set entry_type='thought'    detectIntent → existing routes
   tags=[…]                    (research, calendar, blinkit, whatsapp)
   status='captured'
   (terminal)
```

### 6.2 Classifier: `classifyEntry`

New function in `lib/openai.ts`. One `gpt-4o-mini` call. JSON mode.

**Input:** raw user string.
**Output:**
```typescript
{
  entry_type: 'thought' | 'task',
  tags: string[],           // empty if entry_type='task'
  confidence: number        // 0..1
}
```

**System prompt sketch:**
> Classify the user's input as either a `thought` (a note, idea, reflection, observation, reminder-to-self) or a `task` (a command to research, order, schedule, send, or otherwise act). When in doubt between a vague task and a thought, prefer `thought` — the user can promote it later. If `thought`, assign 0–3 tags from this fixed vocabulary: [list]. Output JSON only.

**Few-shot examples** (built into the prompt — keeps recall high):
- `"find best ANC headphones under $300"` → task
- `"sarah owes me $200"` → thought, tags=[`person`, `followup`]
- `"onboarding feels broken — users skip step 2"` → thought, tags=[`product`, `idea`]
- `"book table at Bestia friday 8pm"` → task
- `"what did cursor ship this week"` → task
- `"i should write a blog post about latency budgets"` → thought, tags=[`idea`]
- `"remind me to call mom"` → thought, tags=[`personal`, `followup`]

**Disambiguation rule for the model:** imperative verb at start (find, book, send, order, schedule, list, summarize, check) → task. Past tense, declarative, or self-directed → thought.

### 6.3 Where classification fires in `executeTask`

Insert one new step before the existing `detect-intent` step:

```typescript
const classification = await step.run("classify-entry", async () => {
  const result = await classifyEntry(input);
  await supabase.from("tasks").update({
    entry_type: result.entry_type,
    tags: result.tags,
    classification_confidence: result.confidence,
  }).eq("id", id);
  return result;
});

if (classification.entry_type === 'thought') {
  await step.run("mark-captured", async () => {
    await supabase.from("tasks")
      .update({ status: 'captured' })
      .eq("id", id);
  });
  return { success: true, captured: true };
}

// else: continue into existing detectIntent path
```

No retries on the thought path. No external calls. Latency ≈ one OpenAI roundtrip (~600ms), but the user has already dismissed the overlay — async is fine.

### 6.4 Promotion API

New route: `POST /api/tasks/[id]/promote`

Behavior:
1. Read source thought.
2. Insert a new row: `entry_type='task'`, `status='pending'`, `input = source.input` (or `source.input + augmentation` if request body carries `extra`).
3. Set source's `promoted_to_task_id = newTask.id`.
4. `inngest.send('task/created', { id: newTask.id })`.
5. Return new task id.

Source thought is **not** deleted — keeps the audit trail and lets the user see "this idea became this task."

### 6.5 Reclassify API

New route: `PATCH /api/tasks/[id]/reclassify`

Body: `{ entry_type: 'thought' | 'task', tags?: string[] }`

If user flips `task → thought`: set type/tags, set `status='captured'`, blank `result_*`. **Caveat:** any side effects already executed (calendar event created, message sent) cannot be undone — surface a warning in the UI and require a confirm. For v1, only allow reclassify if `status IN ('captured', 'done', 'failed', 'pending')` — never on `running` or `needs_approval`.

If user flips `thought → task`: same as promote. Reuse the same handler.

## 7. UI

### 7.1 Dashboard

One stream, reverse chron. Two card types:

**Thought card:**
- Body text (full input, wrap to ~3 lines, expand on click)
- Timestamp (relative: "2h ago")
- Tag chips
- Actions on hover: `Promote to task` · `Edit` · `Delete` · `Wrong tag?`
- No status badge, no spinner, no approval button

**Task card:** existing component, no visual change.

Visual differentiation: thought cards have a left border accent (e.g. dotted grey) so the eye can skim past them when scanning for task status.

### 7.2 Filter bar

Above the stream:
- Toggle: `All · Thoughts · Tasks`
- Tag filter pills (only show tags that exist in current dataset)
- Search box (substring match on `input` for v1 — no embeddings)

### 7.3 Overlay — input

**No change to the input box.** Same hotkey, same Enter behavior, no mode picker. This is non-negotiable — adding any mode picker breaks the wedge.

### 7.4 Overlay — expanded panel (the "taskbar")

Today the expanded panel shows a single list rendered by `renderTaskList` in [electron/overlay/renderer.ts:154](electron/overlay/renderer.ts#L154), sorted by urgency.

**New shape: a Nook-style two-tab switcher at the top of the expanded panel.**

```
┌─────────────────────────────────────────┐
│  [● Tasks]   [  Thoughts  ]             │   ← pill toggle, active tab filled
├─────────────────────────────────────────┤
│  ● run growth audit on signup    2m     │
│  ● find ANC headphones <$300     12m    │
│  ● book table at Bestia          1h     │
└─────────────────────────────────────────┘

(tap Thoughts →)

┌─────────────────────────────────────────┐
│  [  Tasks  ]   [● Thoughts]             │
├─────────────────────────────────────────┤
│  onboarding feels broken — step 2  2m   │
│  sarah owes me $200                15m  │
│  write a blog post on latency      1h   │
└─────────────────────────────────────────┘
```

Rules:
- **Tasks tab** (default on open) = existing behavior unchanged. Same urgency sort, status dots, click → dashboard.
- **Thoughts tab** = new list. Tasks and thoughts **never mix in the panel**.
- Active tab persists across overlay close/reopen within a session; resets to Tasks on Eva restart.

**Thought row spec:**
- Body: thought text, single line, truncate with ellipsis at panel width.
- Time: relative timestamp on right (`2m`, `15m`, `1h`, `3h`, `Mon`).
- **No status dot** (thoughts have no status worth a dot).
- **No tag chips** in overlay (too tight; tags surface on dashboard).
- **No inline actions** (no Promote / Delete buttons in overlay — see Q8 decision below).
- Sort: pure recency, newest first. No urgency, no buckets.
- Row count: render last **10** thoughts only. Footer row: *"… more on dashboard"* — clicking it opens the dashboard with Thoughts filter active.

**Click behavior:**
- Thought row tap → `ipcRenderer.send('open-task', thought.id)` (same channel as tasks). Dashboard scrolls to that row and highlights.
- No inline expand. Decision: keeps overlay fast/skimmable; thought management happens on dashboard.

**Badge:**
- Unchanged. Notch badge counts only actionable tasks (`needs_approval` + `failed`). Thoughts never contribute.

**Tab UI:**
- Pill-style toggle, matches existing overlay aesthetic (frameless, borderless).
- Tap to switch — no swipe gesture in v1.
- Active tab visual: filled background, bolder weight. Inactive: subtle, low-contrast text.

**Commands in input box (when overlay focused with `/`):**
- Existing: `/clear failed`, `/clear done`, `/clear pending`.
- **New:** `/clear thoughts` — bulk-deletes all `entry_type='thought'` rows. Confirm via toast ("Cleared N thoughts").
- Confirm existing `/clear done` / `/clear pending` filter on `entry_type='task'` so they don't sweep thoughts (see EC-13).

**IPC changes:**
- `fetch-tasks` already returns all rows. Renderer splits client-side by `entry_type`. Cheap, simple.
- Add `clear-tasks` handler in [electron/main.ts](electron/main.ts) to accept `'thoughts'` as a status synonym → routes to `DELETE /api/tasks?entry_type=thought`.

**Why no inline Promote/Delete in overlay (Q8):**
- Rows are tight (panel width ~440px expanded). Hover actions on Electron overlays are jittery — the panel auto-collapses when cursor leaves the hover zone ([electron/main.ts:86](electron/main.ts#L86)).
- Thought management is a review activity, not a capture-flow activity. Forcing users to the dashboard for promote/delete keeps the overlay as a pure capture+glance surface.
- If, after 14 days of dogfood, the user finds themselves repeatedly cmd-tabbing to dashboard just to promote thoughts, add a long-press-to-promote gesture. Don't build it speculatively.

### 7.4 Low-confidence affordance

If `classification_confidence < 0.6`, render a tiny ghost button on the card: *"Eva wasn't sure — is this a task?"* Single click flips it. Trains the user that Eva is correctable without being annoying.

## 8. Edge Cases

| # | Case | Behavior |
|---|---|---|
| EC-1 | Empty / whitespace-only input | Reject at API layer (already does). |
| EC-2 | Multi-line input (>500 chars) | Allow up to 4000 chars. Truncate display, store full. |
| EC-3 | Duplicate thought (same string within 60s) | Insert anyway. Dedup is a v2 concern; on a hotkey workflow, accidental double-tap is rare. Don't risk dropping a real second thought. |
| EC-4 | Classifier returns malformed JSON | Fallback: treat as `task`. Reason: research path is graceful; thought path would orphan the row without `result_*`. |
| EC-5 | Classifier API down | Same as EC-4 — default to task, the existing path. **Never** block the row from progressing. |
| EC-6 | User dismisses overlay before Enter | No row created. Existing behavior. |
| EC-7 | Hotkey fires while overlay is already open | Focus existing overlay (don't queue a second). Already handled in `electron/main.ts` — verify. |
| EC-8 | Classifier says `task` but `detectIntent` says nothing matches → falls into research | Correct behavior. No change. |
| EC-9 | Classifier says `thought` but input is imperative ("buy milk") | User edits via "Wrong tag?" → promote. Log the miss to tune classifier later. |
| EC-10 | Promoted task fails | Source thought is untouched. User can re-promote. |
| EC-11 | User deletes a thought that has been promoted | Promotion link breaks (`promoted_to_task_id` was on the thought — moot). Task survives. No cascading delete. |
| EC-12 | User deletes a task that was promoted from a thought | Thought's `promoted_to_task_id` is set to `NULL` via FK `ON DELETE SET NULL`. Thought survives. |
| EC-13 | Bulk delete via existing DELETE `/api/tasks?status=...` | Add `entry_type` filter so `?status=done` doesn't sweep up thoughts (thoughts use `captured`). Audit existing call sites in `app/page.tsx`. |
| EC-14 | Real-time subscription | Existing Supabase subscription works unchanged — new columns flow through. Confirm dashboard renders thought cards without optimistic-update glitches. |
| EC-15 | Long input that smells like both ("I want to find the best laptop for my dad who needs something light") | Classifier should call this a task (imperative "find"). If user disagrees, reclassify. Confidence likely 0.5–0.7 — show the affordance. |
| EC-16 | Sensitive content ("dr appointment thursday", "salary 2.3L") | Stored in Supabase same as anything else. v1 = single-user, trust the DB. Flag for v2: client-side encryption for thought-typed entries only. |
| EC-17 | Tag vocabulary drift (LLM invents a new tag) | Server-side validate against the fixed list. Drop unknown tags silently. Don't fail the row. |
| EC-18 | User edits a thought's text after the fact | Reclassify? **No** — preserve original tags unless user explicitly asks. Edits are typo fixes; treating every edit as a reclassify will surprise users. |
| EC-19 | Backfill existing rows | Don't. Existing tasks stay `entry_type='task'`. Migration default handles it. |
| EC-20 | Inngest retry on classify step | Idempotent — overwrites same row with same result. Safe. But: don't double-spend OpenAI calls on retries → wrap in `step.run` (already the pattern). |
| EC-21 | User offline (Electron has no network) | Overlay POST fails. Existing behavior shows error toast. v1: don't queue locally. Flag for v2. |
| EC-22 | Two thoughts entered in rapid succession (<200ms apart) | Two POSTs, two rows. Fine. |
| EC-23 | Classifier latency tail (p99 > 3s) | User has already dismissed overlay. Card appears on dashboard as `pending` briefly, then becomes thought card. Acceptable. |
| EC-24 | Cost | ~$0.0001 per classify call. At 100/day = $0.30/mo. Negligible. |

## 9. Phasing

**Phase 1 — Capture loop works (1 day)**
- Schema migration
- `classifyEntry` function
- Insert classify step into `executeTask`
- Render thought cards on dashboard (basic — no filters yet)
- Manual delete works

**Phase 2 — Overlay surfaces thoughts (0.5 day)**
- Tab switcher (Tasks / Thoughts) in overlay expanded panel
- `renderThoughtList` — thought rows without status dot, recency sort, last 10 + footer
- `/clear thoughts` command
- Tap row → opens dashboard at that thought
- Confirm `/clear done`/`pending` does not touch thoughts

**Phase 3 — Correction & promotion (0.5 day)**
- `Reclassify` route + UI affordance (dashboard)
- `Promote` route + button (dashboard)
- Tag chips render on dashboard

**Phase 4 — Stream usability (0.5 day)**
- Filter bar on dashboard (All / Thoughts / Tasks + tag pills)
- Substring search
- Edit thought text

**Stop here.** Validate on builder's own usage for 14 days before adding digest/embeddings/promotion-suggestions.

## 10. Success Metrics

Only matters if the builder's own behavior changes. Instrument lightly:

- **Daily capture count** — target ≥ 20 thoughts/day within first 2 weeks. Below 5/day = product not in muscle memory.
- **Classifier accuracy** — % of entries the user reclassifies. Target < 5%. Above 10% = retune prompt.
- **Promotion rate** — % of thoughts promoted to tasks within 7 days. Target 5–15%. Zero = thoughts are write-only graveyards (bad). 50%+ = users are misusing thought capture as a draft task (also bad).
- **Time-to-dismiss** — overlay open → close. Should stay <1.5s on average. If classification slows the user's perception of the loop, kill the classify-on-write idea and move it to a deferred Inngest step that fires after the row is created.

## 11. Risks & Open Questions

- **R1:** Classifier wrong too often. *Mitigation:* fixed tag vocab, few-shot examples, low-confidence affordance, easy reclassify.
- **R2:** Thought stream becomes overwhelming after 2 weeks. *Mitigation:* filters in Phase 3. If still bad, add time-bucketing (Today / Yesterday / This Week / Older).
- **R3:** Builder stops using it because thoughts feel like clutter on the task dashboard. *Mitigation:* the All/Thoughts/Tasks toggle, plus visual differentiation. If still bad, consider a separate `/thoughts` route.
- **OQ-1:** Should classifier run before or after the insert? *Decision:* after — keep the write fast, run classify inside Inngest. Already the architecture.
- **OQ-2:** Do thoughts need a separate Supabase table for clean row counts? *Decision:* no for v1. One table = one query = simpler dashboard. Revisit if rows pass 100k.
- **OQ-3:** Should the overlay show a tiny inline indicator that says "captured as thought" vs "running as task"? *Decision:* no. Overlay is fire-and-forget. Indicator is on the dashboard.

## 12. Files Touched

**Backend / data:**
- `supabase_migration.sql` — add migration block
- `lib/openai.ts` — add `classifyEntry`
- `inngest/executeTask.ts` — insert `classify-entry` step before `detect-intent`
- `app/api/tasks/route.ts` — accept `entry_type` query param for filtered DELETE; ensure POST result returns new columns
- `app/api/tasks/[id]/promote/route.ts` — **new**
- `app/api/tasks/[id]/reclassify/route.ts` — **new**

**Web dashboard:**
- `app/components/ThoughtCard.tsx` — **new**
- `app/components/FilterBar.tsx` — **new** (All / Thoughts / Tasks + tag pills + search)
- `app/page.tsx` — route by `entry_type` to `TaskCard` vs `ThoughtCard`, wire filter bar, support deep-link scroll-to-id from overlay

**Electron overlay:**
- `electron/overlay/renderer.ts` — add tab switcher (Tasks / Thoughts), render `renderThoughtList` alongside existing `renderTaskList`, split fetched rows by `entry_type` client-side, handle `/clear thoughts` command
- `electron/overlay/index.html` (or equivalent) — add tab DOM
- `electron/main.ts` — extend `clear-tasks` IPC to accept `'thoughts'` synonym
- Overlay styles — pill toggle, thought row variant (no status dot)

**Docs:**
- `CLAUDE.md` — update spec to include `entry_type`, thoughts feature, overlay tab structure

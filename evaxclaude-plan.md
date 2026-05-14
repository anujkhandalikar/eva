# Eva × Claude — Calendar Task Integration Plan

**Status:** Ready for sign-off — answers incorporated, implementation scope defined

---

## Decisions Locked

| Question | Decision |
|---|---|
| What is "pass to Claude"? | Generate a `claude.ai` URL with the task pre-filled → open via Electron `shell.openExternal` OR show "Open in Claude →" button on card |
| Which calendar? | Google Calendar |
| Auth | User's Claude.ai already has Google Calendar MCP connected — not Eva's problem |
| Detection | LLM classification step (before routing) |
| Eva executes or hands off? | Hands off only — card shows "Task passed successfully to Claude", no callback |
| Approval gate? | None — submitting via hotkey is approval |
| Routing scope? | Generic routing system — calendar is first handler, extensible to email/other |

---

## Architecture

### Flow

```
User input (hotkey)
       │
       ▼
POST /api/tasks  ──► Supabase insert (status: pending, task_type: null)
       │
       ▼
Inngest: execute-task
       │
       ├── Step 1: classify-intent
       │       Calls LLM (gpt-4o-mini) with input
       │       Returns: { task_type: 'research' | 'calendar' | 'email' | ... }
       │       Writes task_type to Supabase
       │
       └── Step 2: route-to-handler
               ├── 'research'  → existing OpenAI web search path (unchanged)
               └── 'calendar'  → NEW: Claude handler
                       ├── Build claude.ai URL:
                       │     https://claude.ai/new?q={encodeURIComponent(input)}
                       ├── Store url in result_full
                       └── Update card:
                               status = 'done'
                               task_type = 'calendar'
                               result_summary = 'Task passed successfully to Claude'
                               claude_url = <url>
```

### Routing System Design

```typescript
// lib/router.ts
type TaskType = 'research' | 'calendar' | 'email'  // extend as needed

type RouteResult = {
  task_type: TaskType
  confidence: number
  reason: string
}

async function classifyTask(input: string): Promise<RouteResult>
```

Single LLM call with a compact classification prompt. Returns structured JSON. Fast — `gpt-4o-mini`, no web search.

---

## Data Model Changes

### Supabase: 2 new columns on `tasks` table

```sql
ALTER TABLE tasks ADD COLUMN task_type TEXT DEFAULT 'research';
ALTER TABLE tasks ADD COLUMN claude_url TEXT;
```

| Column | Type | Purpose |
|---|---|---|
| `task_type` | text | 'research' \| 'calendar' \| 'email' — drives routing |
| `claude_url` | text \| null | Pre-built claude.ai link for claude-routed tasks |

---

## File Changes

### New file: `lib/router.ts`
- `classifyTask(input)` — LLM classification, returns `TaskType`
- Prompt: compact, structured JSON output, no web search
- Extensible: add new `TaskType` values here as integrations grow

### Modified: `inngest/executeTask.ts`
- Add Step 1: call `classifyTask`, write `task_type` to DB
- Add routing branch: `task_type === 'calendar'` → build URL, update card
- Existing `research` path untouched

### Modified: `app/components/TaskCard.tsx`
- If `task_type === 'calendar'` (or any non-research claude task):
  - Show: `✓ Task passed successfully to Claude`
  - Show link button: `Open in Claude →` pointing to `claude_url`
  - No 3-bullet summary rendering

---

## Card UI — Calendar Task

```
┌─────────────────────────────────────────────┐
│  Add meeting with John tomorrow at 3pm       │
│  ─────────────────────────────────────────  │
│  ✓ Task passed successfully to Claude        │
│                                              │
│  [Open in Claude →]          Done  12:34 PM  │
└─────────────────────────────────────────────┘
```

---

## What Does NOT Change

- Electron hotkey capture — unchanged
- `/api/tasks` POST route — unchanged  
- OpenAI research path — unchanged
- Supabase real-time subscription — unchanged
- Approval gate for research tasks — unchanged

---

## Implementation Order

1. **DB migration** — add `task_type`, `claude_url` columns
2. **`lib/router.ts`** — classification function + prompt
3. **`inngest/executeTask.ts`** — add classify step + routing branch
4. **`app/components/TaskCard.tsx`** — render claude-task variant

---

## Classification Prompt (draft)

```
You are a task router. Classify the user's input into exactly one task type.

Task types:
- research: questions, lookups, web searches, "find out about X", "who is X", "what is X"
- calendar: adding events, scheduling meetings, blocking time, "add to calendar", "schedule X", "remind me at", "book time for"
- email: sending or drafting emails (future)

User input: "${input}"

Respond with ONLY valid JSON:
{ "task_type": "research" | "calendar" | "email", "reason": "one sentence" }
```

---

*Plan updated: 2026-05-12 — answers incorporated — awaiting sign-off*

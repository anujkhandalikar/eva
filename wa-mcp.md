# wa-mcp.md — WhatsApp MCP Integration Plan

## What We're Building

Connect Eva to WhatsApp via [lharries/whatsapp-mcp](https://github.com/lharries/whatsapp-mcp).
Eva can then: search messages, read chats, and **send messages** (behind approval gate).

---

## Architecture

```
Eva Inngest job
    └── calls Claude (gpt-4o-mini or claude)
            └── Claude uses MCP tools
                    └── Python MCP server (whatsapp-mcp-server/main.py)
                            └── Go bridge (whatsapp-bridge/main.go)
                                    └── WhatsApp Web API → SQLite
```

Two long-running processes needed alongside Eva:
- `whatsapp-bridge` — Go process, holds the WA session
- `whatsapp-mcp-server` — Python process, speaks MCP

---

## Prerequisites

| Tool | Check |
|------|-------|
| Go ≥ 1.21 | `go version` |
| Python ≥ 3.6 | `python3 --version` |
| uv | `uv --version` |
| FFmpeg (optional, audio) | `ffmpeg -version` |

---

## Step 1 — Clone & Build

```bash
# from repo root or ~/tools — NOT inside eva/
git clone https://github.com/lharries/whatsapp-mcp.git ~/tools/whatsapp-mcp
cd ~/tools/whatsapp-mcp/whatsapp-bridge
go build -o whatsapp-bridge .
```

---

## Step 2 — One-Time Auth (QR scan)

```bash
cd ~/tools/whatsapp-mcp/whatsapp-bridge
./whatsapp-bridge
# QR code prints in terminal → scan with WhatsApp on phone
# Session saved to store/whatsapp.db — don't delete this
```

Gotchas:
- Re-auth needed every ~20 days
- WhatsApp limits devices — remove old sessions in WA app if QR fails
- First sync (message history) takes a few minutes

---

## Step 3 — Register MCP in Claude Code

Add to `~/.claude/claude_desktop_config.json` (or Claude Code MCP settings):

```json
{
  "mcpServers": {
    "whatsapp": {
      "command": "uv",
      "args": [
        "--directory",
        "/Users/anujk/tools/whatsapp-mcp/whatsapp-mcp-server",
        "run",
        "main.py"
      ]
    }
  }
}
```

Restart Claude Code after adding. Verify tools load: Claude should see `search_contacts`, `list_chats`, etc.

---

## Step 4 — Eva Task Model Changes

Add `whatsapp` to task types in Supabase + TypeScript types:

```typescript
// existing Task type gains:
task_type: 'research' | 'calendar' | 'blinkit' | 'whatsapp'

// for whatsapp send tasks:
proposed_message: {
  recipient: string      // phone number or chat JID
  recipient_name: string // resolved from search_contacts
  body: string
} | null
```

New Supabase columns:
- `proposed_message jsonb` — populated when Eva wants to send a WA message
- No new status values needed — `needs_approval` covers send gates

---

## Step 5 — Inngest Handler

New function: `inngest/executeWhatsappTask.ts`

**Read flow** (search/list — no approval needed):
```
input → classify → call MCP tools via Claude → summarise → write to tasks (status: done)
```

**Send flow** (message send — requires approval):
```
input → classify → resolve recipient via search_contacts
      → draft message body
      → write proposed_message + status: needs_approval
      → STOP. Wait for dashboard approval.
      → on approval → send_message via MCP → status: done
```

Eva's existing approval endpoint (`/api/tasks/[id]/approve`) calls the MCP `send_message` tool using stored `proposed_message`.

---

## Step 6 — MCP Tools Eva Will Use

| Tool | Use case | Approval? |
|------|----------|-----------|
| `search_contacts` | Resolve "message Rahul" → JID | No |
| `list_chats` | "what chats do I have with X?" | No |
| `list_messages` | "what did X say last?" | No |
| `get_last_interaction` | Context for summaries | No |
| `send_message` | Send text to person/group | **Yes** |
| `send_file` | Send doc/image | **Yes** |
| `download_media` | Fetch media from message | No |

`send_audio_message` — skip for now (FFmpeg dep, P2).

---

## Step 7 — Dashboard Card Changes

`TaskCard.tsx` — new section for `task_type === 'whatsapp'` + `status === 'needs_approval'`:

```
┌─────────────────────────────────────────────┐
│ WhatsApp · Needs Approval            [yellow]│
│ Send to: Rahul (+91 98xxx xxxxx)            │
│ ─────────────────────────────────────────── │
│ "Hey, are we still on for dinner at 8?"     │
│                                             │
│            [Cancel]  [Send Message]         │
└─────────────────────────────────────────────┘
```

---

## Step 8 — Process Management

**Decision: wired into Eva's dev startup.**

Create `eva/start.sh`:

```bash
#!/bin/bash
set -e

# Start WA bridge in background
echo "Starting WhatsApp bridge..."
cd ~/tools/whatsapp-mcp/whatsapp-bridge
./whatsapp-bridge &
WA_PID=$!

# Trap Ctrl+C — kill bridge when Eva exits
trap "kill $WA_PID 2>/dev/null; exit" SIGINT SIGTERM

# Start Eva
cd ~/eva
npm run dev

# Cleanup on exit
kill $WA_PID 2>/dev/null
```

```bash
chmod +x start.sh
# Use ./start.sh instead of npm run dev going forward
```

The Python MCP server is started on-demand by Claude Code's MCP runtime — no manual start needed.

---

## Approval Gate Security Rules

- `send_message` / `send_file` — always `needs_approval`, never auto-execute
- Approval endpoint must validate `task.requires_approval === true` and `task.approved === false` before calling MCP
- Store recipient JID + message body in `proposed_message` at parse time, not at approval time (no re-generation)

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| WA session expires (~20 days) | surfaced as task `failed` with clear error; user re-scans QR |
| Wrong recipient resolved | approval card shows full name + number before send |
| Prompt injection via WA messages | don't pass raw message content to Claude without sanitisation |
| Bridge process crashes | Inngest job catches MCP error → task marked `failed` |

---

## Build Order

1. Clone + auth (Steps 1–2) — validate Go bridge works
2. MCP registration (Step 3) — validate tools appear in Claude Code
3. Supabase columns (Step 4) — migration script
4. Read-only Inngest handler first (Step 5, read flow only)
5. Dashboard read display
6. Send flow + approval gate (Step 5 send + Step 6 + Step 7)
7. Test end-to-end: "message [contact] [text]" → approval → sent

---

*wa-mcp.md — Eva WhatsApp integration plan — May 2026*

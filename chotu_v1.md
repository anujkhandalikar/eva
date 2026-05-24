# Chotu v1 — Noticing Beauty Auto-Poster
## Spec for Claude Code

---

## What This Does

Automatically posts one photo + caption to the "Noticing Beauty" WhatsApp group every day at 11:11 AM IST, for 10 consecutive days. Posts are preloaded before the owner leaves for Vipassana (27th June). No human intervention required during the 10 days.

---

## Hard Constraints

- MacBook stays on, lid open, sleep disabled, connected to WiFi
- Phone will be off — solution must NOT depend on phone being active
- WhatsApp already linked to MacBook as a linked device (active for up to 14 days without phone)
- Builds on whatsapp-web.js already set up in chotu v0
- No new infra. Runs locally on MacBook.

---

## Preloading — How the User Sets It Up

**Folder structure:**

```
/noticing-beauty-posts/
  posts.txt
  day1.jpg
  day2.jpg
  ...
  day10.jpg
  sent_log.json       ← auto-created by scheduler
  chotu.log           ← auto-created by scheduler
```

**posts.txt format:**

```
day1.jpg | Caption for day 1
day2.jpg | Caption for day 2
...
day10.jpg | Caption for day 10
```

- One line per day, in order
- Pipe `|` separates filename from caption
- Images can be jpg or png

---

## Timezone

- MacBook system timezone MUST be set to IST (Asia/Kolkata) before running setup
- Scheduler reads system timezone — if it's wrong, posts go out at wrong time
- `setup.sh` must verify timezone and warn if it's not IST before proceeding

---

## Scheduler Behavior

- Runs as a persistent background process via pm2
- Checks every minute if it's time to post (cron: `11 11 * * *` IST)
- On trigger:
  1. Calculates day number based on today's date (Day 1 = 27th June, Day 10 = 6th July)
  2. Checks sent_log.json — if today already sent, skip
  3. Reads corresponding line from posts.txt
  4. Sends photo + caption to "Noticing Beauty" WhatsApp group
  5. Logs result

- Outside Day 1–10 range: does nothing
- After Day 10: process can stay running, it will just do nothing

---

## Late Start Recovery

If the scheduler starts AFTER 11:11 AM on Day 1 (27th June), it must not silently skip Day 1.

**Behavior:**
- On startup, check if today is a valid post day AND today's post has NOT been sent
- If current time is between 11:11 AM and 11:59 PM IST on a valid day → send immediately (catch-up)
- If current time is past 11:59 PM → log as missed, do not send
- Log all catch-up sends clearly: `[CATCH-UP] Day 1 sent at 14:32 — scheduler started late`

---

## WhatsApp Session Persistence on Restart

**Critical:** whatsapp-web.js must save the authenticated session to disk and reload it on restart. Without this, every pm2 restart triggers a QR code scan — which is impossible when the owner is away.

- Session must be saved to a local folder (e.g., `.wwebjs_auth/`)
- On startup, load existing session from disk before attempting connection
- If session is missing or expired, log a clear error and do NOT attempt to send
- Never prompt for QR code interactively — fail loudly instead

**Test this explicitly in dry-run before 27th June:**
1. Start the server
2. Kill it with `pm2 restart`
3. Confirm it reconnects without QR scan

---

## Sent-Posts Tracking

- `sent_log.json` lives in the posts folder
- Check before every send — if today's date exists, skip
- Write after every successful send

**Format:**
```json
[
  { "date": "2026-06-27", "day": 1, "status": "sent", "timestamp": "2026-06-27T11:11:03+05:30" },
  { "date": "2026-06-28", "day": 2, "status": "sent", "timestamp": "2026-06-28T11:11:02+05:30" }
]
```

---

## Failure Alerting

Logs on a MacBook nobody is reading are useless. Someone must be notified if things break.

- On any send failure, send an email alert to a pre-configured address (one trusted person)
- Use nodemailer with a Gmail app password (no OAuth complexity)
- Alert contains: day number, error message, timestamp
- Configure email in a `.env` file:

```
ALERT_EMAIL=trustedperson@gmail.com
GMAIL_USER=yourname@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

- If email itself fails, log it and move on — do not crash the process

---

## Process Management

- Use **pm2** for process management
- Auto-restart on crash
- Start on MacBook boot (handles unexpected restarts)

**Commands setup.sh must run:**
```bash
pm2 start scheduler.js --name "noticing-beauty"
pm2 save
pm2 startup
```

---

## Power / Sleep Protection

MacBook must not sleep. Two layers:

1. System Settings → Battery → "Prevent automatic sleeping when display is off" — enable
2. `setup.sh` runs `caffeinate -i &` as an extra layer to prevent sleep programmatically

---

## Logging

- File: `/noticing-beauty-posts/chotu.log`
- Append-only, never overwrite

**Format:**
```
[2026-06-27 11:11:03 IST] Day 1 — Sending day1.jpg...
[2026-06-27 11:11:05 IST] Day 1 — SUCCESS.
[2026-06-27 14:32:10 IST] [CATCH-UP] Day 1 sent at 14:32 — scheduler started late.
[2026-06-28 11:11:01 IST] Day 2 — Already sent today. Skipping.
[2026-06-29 11:11:04 IST] Day 3 — FAILED. WhatsApp not connected. Retrying in 5 min.
[2026-06-29 11:16:04 IST] Day 3 — SUCCESS on retry 1.
```

---

## Error Handling

| Error | Behavior |
|---|---|
| WhatsApp not connected | Retry after 5 min, max 3 retries, then email alert |
| Session missing/expired on startup | Log error, email alert, do not attempt send |
| Group "Noticing Beauty" not found | Email alert, stop retrying — this is a config issue |
| Image file missing | Send caption-only as fallback, log warning |
| posts.txt missing or malformed | Email alert, do nothing |
| Already sent today | Skip, log it |
| All 3 retries failed | Email alert with full error |

---

## Files Claude Code Must Produce

1. `scheduler.js` — main script: cron logic, day calculation, catch-up logic, send orchestration
2. `whatsapp.js` — WhatsApp connection with session persistence + send helper
3. `alerter.js` — email alert helper using nodemailer
4. `setup.sh` — one-time setup: timezone check, pm2 install, caffeinate, startup config
5. `.env.template` — template for email config with instructions
6. `posts.txt` — empty template with format instructions as comments

---

## Dry-Run Test (Must Pass Before 27th June)

Claude Code must include a `test.js` script that:

1. Verifies MacBook timezone is IST
2. Verifies WhatsApp connects and session loads without QR scan
3. Verifies group "Noticing Beauty" is found
4. Sends a test message ("Chotu dry-run test — ignore") to the group
5. Kills and restarts the process via pm2, then re-runs steps 2–3 to confirm session persistence
6. Sends a test email alert to confirm alerting works

All 6 steps must pass before the owner leaves.

---

## What the User Does Before 27th June

1. Confirm MacBook timezone is IST
2. Disable sleep: System Settings → Battery → Prevent automatic sleeping
3. Add Gmail app password to `.env`
4. Fill in `posts.txt` and add 10 photos to the folder
5. Run `setup.sh` once
6. Run `node test.js` — all 6 checks must pass
7. Leave

---

## Out of Scope

- Generating captions
- Posting to Instagram, YouTube, or any other platform
- Reading or replying to messages
- Anything after Day 10 (6th July)
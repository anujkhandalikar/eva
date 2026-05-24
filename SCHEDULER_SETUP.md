# Eva Scheduler — Setup & Pre-Leave Checklist

## One-time setup

### 1. Run DB migration
Open Supabase SQL editor and paste `supabase_scheduler_migration.sql`. Verifies `scheduled_tasks` table exists.

### 2. Process management with pm2
```bash
npm install -g pm2

# Eva (Next.js)
cd /Users/anujk/eva
npm run build
pm2 start "npm start" --name eva

# WhatsApp bridge
cd /Users/anujk/tools/whatsapp-mcp/whatsapp-bridge
pm2 start "go run ." --name wa-bridge

pm2 save
pm2 startup   # follow the printed command, paste back into terminal
```

Both processes now auto-restart on crash and on MacBook boot.

Useful:
- `pm2 status`
- `pm2 logs eva`
- `pm2 logs wa-bridge`
- `pm2 restart eva`

### 3. Image storage
Drop your post images into `/Users/anujk/eva/scheduled-media/`. Folder is gitignored. Use any subfolder structure you want (e.g. `scheduled-media/noticing-beauty/day1.jpg`).

You'll paste the **absolute** path into the UI when creating a schedule.

---

## Chotu seed (the 10 Noticing Beauty posts)

1. Drop `day1.jpg` … `day10.jpg` into `/Users/anujk/eva/scheduled-media/noticing-beauty/`.
2. Open `http://localhost:3000/scheduled`.
3. For each day, create a **one-shot** schedule:
   - Fire at (IST): 2026-06-27 11:11, 2026-06-28 11:11, … 2026-07-06 11:11
   - Recipient: `Noticing Beauty`
   - Message: caption for that day
   - Image path: e.g. `/Users/anujk/eva/scheduled-media/noticing-beauty/day1.jpg`
4. Hit **Run now** on the first row as a smoke test. Confirm message lands in WhatsApp group.
5. After smoke test, manually delete the test message from the group. Re-create the Day 1 row (Run now consumes the schedule's last status but doesn't reset its fire time — so it's still scheduled, but you've now used your "dry-run shot").

---

## Pre-leave checklist (do all before 27th June)

- [ ] Re-link WhatsApp Web on the day before departure (resets 14-day timer)
- [ ] All 10 Chotu schedules created and visible at `/scheduled`
- [ ] System Settings → Battery → Power Adapter → "Prevent automatic sleeping when display is off" ON
- [ ] System Settings → General → Software Update → Automatic updates OFF
- [ ] Auto-restart after power failure: run `sudo pmset -a autorestart 1` (verify with `pmset -g | grep autorestart` → should print `autorestart  1`). MacBooks hide this in the GUI, terminal is the only way.
- [ ] MacBook plugged in, lid open, on home wifi
- [ ] `pm2 status` shows `eva` and `wa-bridge` both online
- [ ] `pm2 logs eva | grep scheduler` shows ticks firing every minute
- [ ] Smoke test passed for Day 1 row

---

## What happens if it breaks while you're away

Honest answer: nothing. There's no recovery path because nobody can re-scan a QR code without your phone (which is off).

Mitigations in place:
- Bridge process crash → pm2 auto-restarts
- Eva process crash → pm2 auto-restarts
- MacBook reboot (power blip) → both processes auto-start, scheduler catches up any missed post within the same IST day
- MacBook off > end of IST day → that day's post marked `missed` in DB; future days still fire

Risks accepted:
- WhatsApp account flagged / linked-session expires
- macOS forced restart for an update (mitigated by disabling auto-update)
- Multi-day power/internet outage

---

## Logs

- Scheduler tick logs: `pm2 logs eva` (look for `[scheduler]` prefix)
- WhatsApp bridge logs: `pm2 logs wa-bridge`
- Per-schedule status: visible in the `/scheduled` UI table (`last_status`, `last_error`)

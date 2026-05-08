# Electron Solver — Fix Plan

## Problems to Solve

1. Key-repeat events corrupt `lastCtrlPressTime`, making double-tap unreliable
2. Focus → blur race causes overlay to show then immediately hide
3. No Accessibility permission guard — uIOhook failures are silent
4. `alwaysOnTop` level too low — other windows can sit above overlay
5. Hardcoded `localhost:3000` — no env variable fallback
6. Task submission failures are invisible to the user
7. `main.js` compiled output committed to source control
8. Input focus on re-show is unreliable

---

## Fix 1 — Key-Repeat (Root Cause of Intermittent Double-Tap)

**File:** `electron/main.ts`

Track `keyup` so only distinct physical presses are counted. A press only qualifies if Ctrl was released between taps.

```
let ctrlCurrentlyDown = false;

uIOhook.on('keydown', (e) => {
  if (e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight) {
    if (ctrlCurrentlyDown) return; // ignore key-repeat
    ctrlCurrentlyDown = true;

    const now = Date.now();
    if (now - lastCtrlPressTime < DOUBLE_TAP_THRESHOLD) {
      toggleOverlay();
      lastCtrlPressTime = 0;
    } else {
      lastCtrlPressTime = now;
    }
  }
});

uIOhook.on('keyup', (e) => {
  if (e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight) {
    ctrlCurrentlyDown = false;
  }
});
```

---

## Fix 2 — Focus/Blur Race

**File:** `electron/main.ts`

The `blur` handler fires if `focus()` loses the race with macOS window animations. Guard with a short suppress flag so the blur handler ignores the blur immediately following a programmatic show.

```
let suppressBlur = false;

mainWindow.on('blur', () => {
  if (suppressBlur) return;
  mainWindow?.hide();
});

// Inside toggleOverlay(), before show():
suppressBlur = true;
mainWindow.show();
// ... setPosition ...
mainWindow.focus();
setTimeout(() => { suppressBlur = false; }, 200);
```

200ms is enough to clear the post-show blur event without letting real external blurs through.

---

## Fix 3 — Accessibility Permission Guard

**File:** `electron/main.ts`

Wrap `uIOhook.start()` in a try/catch and surface the failure visibly (dialog or console warning with actionable message).

```
try {
  uIOhook.start();
} catch (err) {
  console.error('[eva] uIOhook failed to start. Grant Accessibility access: System Settings → Privacy & Security → Accessibility → enable Eva.');
  // Optionally show a native dialog:
  dialog.showErrorBox(
    'Eva — Accessibility Permission Required',
    'Grant Accessibility access in System Settings → Privacy & Security → Accessibility, then restart Eva.'
  );
}
```

Import `dialog` from `electron`.

---

## Fix 4 — alwaysOnTop Level

**File:** `electron/main.ts`

After `createWindow()`, set a higher window level so system overlays don't obscure the overlay.

```
// Replace alwaysOnTop: true in BrowserWindow options with:
mainWindow.setAlwaysOnTop(true, 'floating');
```

`'floating'` sits above normal windows. Use `'screen-saver'` only if `'floating'` still gets covered (it goes above fullscreen apps too, which may be undesirable).

---

## Fix 5 — Hardcoded URL

**File:** `electron/main.ts`

Read the Next.js port from an environment variable with a fallback.

```
const NEXT_PORT = process.env.EVA_NEXT_PORT ?? '3000';
const API_BASE = `http://localhost:${NEXT_PORT}`;

// In submit-task handler:
const response = await fetch(`${API_BASE}/api/tasks`, { ... });
```

Set `EVA_NEXT_PORT` in the npm start script or a `.env` file if the port ever changes.

---

## Fix 6 — Silent Task Submission Failure

**File:** `electron/main.ts` + `electron/overlay/renderer.ts`

Send a failure signal back to the renderer so the user sees it in the overlay.

In `main.ts` `submit-task` handler:
```
if (!response.ok) {
  event.sender.send('submit-error', 'Server error — check dashboard');
}
// In catch block:
event.sender.send('submit-error', 'Could not reach Eva server');
```

In `renderer.ts`:
```
ipcRenderer.on('submit-error', (_event, message: string) => {
  input.placeholder = message;
  input.style.color = 'rgba(255,80,80,0.9)';
  setTimeout(() => {
    input.placeholder = "What's the task?";
    input.style.color = 'white';
  }, 3000);
});
```

---

## Fix 7 — Compiled Output in Source Control

**File:** `electron/.gitignore` (create if missing)

```
main.js
main.js.map
overlay/renderer.js
overlay/renderer.js.map
overlay/renderer.d.ts
overlay/renderer.d.ts.map
```

Add a `prepare` script to `electron/package.json` so `tsc` always runs before Electron starts:
```json
"scripts": {
  "start": "tsc && env -u ELECTRON_RUN_AS_NODE electron ."
}
```

This already exists — just add the `.gitignore` entries.

---

## Fix 8 — Input Focus on Re-Show

**File:** `electron/overlay/renderer.ts`

`window focus` is unreliable on alwaysOnTop windows. Also listen for a direct IPC signal from main after show/focus.

In `main.ts` inside `toggleOverlay()` after `mainWindow.focus()`:
```
mainWindow.webContents.send('focus-input');
```

In `renderer.ts`:
```
ipcRenderer.on('focus-input', () => {
  input.focus();
  input.select();
});
```

Keep the `window focus` listener as a fallback.

---

## Order of Implementation

| Priority | Fix | Why |
|---|---|---|
| 1 | Fix 1 (key-repeat) | Root cause of intermittent double-tap |
| 2 | Fix 2 (blur race) | Second most likely cause of "did not open" |
| 3 | Fix 3 (Accessibility guard) | Silent failure is a debugging black hole |
| 4 | Fix 8 (input focus) | Directly affects usability after overlay opens |
| 5 | Fix 4 (alwaysOnTop level) | Low risk, easy win |
| 6 | Fix 6 (submission feedback) | UX quality |
| 7 | Fix 5 (hardcoded URL) | Low urgency for local dev |
| 8 | Fix 7 (gitignore) | Hygiene, no runtime impact |

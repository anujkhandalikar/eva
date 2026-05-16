import { app, BrowserWindow, ipcMain, screen, shell } from 'electron';
import * as path from 'path';
import { uIOhook, UiohookKey } from 'uiohook-napi';

const native: { placeInNotch: (handle: Buffer, w: number, h: number) => void } =
  require('./build/Release/window_native.node');

let mainWindow: BrowserWindow | null = null;
let openedViaHotkey = false;

const W = 300;
const H = 68;

// Ambient mode: wide pill same width as the open pill, centered on the notch.
// Hangs ~NOTCH_EXTENSION_PX below the menu bar so the pill visually merges
// with the notch ("the notch came down a little"). On hover, height grows
// from ambientH to H, looking like the notch extending into the full pill.
const W_AMBIENT = W;
const NOTCH_EXTENSION_PX = -4;
function ambientH(): number {
  return screen.getPrimaryDisplay().workArea.y + NOTCH_EXTENSION_PX;
}

function createWindow() {
  const h0 = ambientH();
  mainWindow = new BrowserWindow({
    width: W_AMBIENT,
    height: h0,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    hasShadow: false,
    roundedCorners: false,
    show: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.loadFile(path.join(__dirname, 'overlay/index.html'));

  // Position ambient indicator right of notch on first paint.
  mainWindow.webContents.once('did-finish-load', () => {
    if (!mainWindow) return;
    moveToAmbient();
    mainWindow.webContents.send('notch-height', screen.getPrimaryDisplay().workArea.y);
  });

  // On blur, collapse to ambient size (don't fully hide — dot must remain visible).
  mainWindow.on('blur', () => {
    if (mainWindow?.isFocused()) return;
    collapseToAmbient();
  });
}

function moveToAmbient() {
  if (!mainWindow) return;
  // Centered, ambient size. placeInNotch installs the frame-constraint swizzle
  // so the window sits flush with the top of the screen at y=0.
  native.placeInNotch(mainWindow.getNativeWindowHandle(), W_AMBIENT, ambientH());
}

function collapseToAmbient() {
  if (!mainWindow) return;
  cancelResizeAnim();
  // Animate height down so the pill smoothly retracts back into the notch shape.
  animateResize(W_AMBIENT, ambientH());
  mainWindow.webContents.send('did-hide');
}

function isOverlayOpen(): boolean {
  if (!mainWindow) return false;
  const [, h] = mainWindow.getSize();
  return h > ambientH() + 4;
}

function showOverlay(grabFocus = false) {
  if (!mainWindow || isOverlayOpen()) return;
  openedViaHotkey = grabFocus;

  // Re-assert window level and workspace visibility on every show — macOS can
  // demote the window level after Mission Control / Space switches.
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  cancelResizeAnim();
  // Window stays centered (same x as ambient). Just animate height up.
  animateResize(W, H);

  if (grabFocus) {
    // Steal focus from the foreground app so the pill input is ready to type.
    // Without app.focus(steal:true), mainWindow.focus() alone fails on macOS
    // when another app owns the input — the keystroke goes to that app.
    app.focus({ steal: true });
    mainWindow.focus();
  }
  mainWindow.webContents.send('did-show');
}

function hideOverlay() {
  if (!mainWindow || !isOverlayOpen()) return;
  openedViaHotkey = false;
  collapseToAmbient();
}

app.whenReady().then(() => {
  createWindow();

  const display = screen.getPrimaryDisplay();
  const screenCenterX = display.bounds.width / 2;
  const menuBarH = display.workArea.y;
  // Hover zone: span full pill width so any part of the always-visible
  // notch-extension strip activates the expand.
  const NOTCH_HALF_W = W_AMBIENT / 2;
  const AMBIENT_BOTTOM_Y = menuBarH + NOTCH_EXTENSION_PX;
  const HOVER_ZONE_H = menuBarH + H + 10;

  let ctrlDown = false;
  let otherKeyWhileCtrl = false;
  let hoverEnterTimer: ReturnType<typeof setTimeout> | null = null;
  let hoverLeaveTimer: ReturnType<typeof setTimeout> | null = null;

  // ── Single Ctrl tap ──
  uIOhook.on('keydown', (e) => {
    if (e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight) {
      ctrlDown = true;
      otherKeyWhileCtrl = false;
    } else if (ctrlDown) {
      otherKeyWhileCtrl = true;
    }
  });

  uIOhook.on('keyup', (e) => {
    if (e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight) {
      if (!otherKeyWhileCtrl) {
        if (isOverlayOpen()) hideOverlay();
        else showOverlay(true); // ctrl tap grabs focus so user can type immediately
      }
      ctrlDown = false;
      otherKeyWhileCtrl = false;
    }
  });

  // ── Hover to activate / deactivate ──
  const HOVER_MARGIN = 6;

  uIOhook.on('mousemove', (e) => {
    const withinX = Math.abs(e.x - screenCenterX) <= NOTCH_HALF_W;
    // Activate when cursor is anywhere in the always-visible notch-extension
    // strip (menu-bar height + ambient extension below).
    const inNotch = withinX && e.y <= AMBIENT_BOTTOM_Y;

    // stay open while cursor is anywhere over the current window rect
    // (window resizes as the panel expands, so use live bounds — the static
    // HOVER_ZONE_H only covers the collapsed notch + base input row).
    let inPanel: boolean;
    if (isOverlayOpen()) {
      const b = mainWindow!.getBounds();
      inPanel =
        e.x >= b.x - HOVER_MARGIN &&
        e.x <= b.x + b.width + HOVER_MARGIN &&
        e.y >= 0 &&
        e.y <= b.y + b.height + HOVER_MARGIN;
    } else {
      inPanel = withinX && e.y <= HOVER_ZONE_H;
    }

    if (inNotch) {
      if (hoverLeaveTimer) { clearTimeout(hoverLeaveTimer); hoverLeaveTimer = null; }
      if (!isOverlayOpen() && !hoverEnterTimer) {
        hoverEnterTimer = setTimeout(() => {
          showOverlay(false); // hover: don't steal focus from current app
          hoverEnterTimer = null;
        }, 150);
      }
    } else {
      if (hoverEnterTimer) { clearTimeout(hoverEnterTimer); hoverEnterTimer = null; }
      // don't auto-close if user opened via Ctrl — they're in control
      if (!inPanel && isOverlayOpen() && !openedViaHotkey && !hoverLeaveTimer) {
        hoverLeaveTimer = setTimeout(() => {
          hideOverlay();
          hoverLeaveTimer = null;
        }, 200);
      }
    }
  });

  uIOhook.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  uIOhook.stop();
});

ipcMain.on('submit-task', async (event, task) => {
  console.log('Task captured:', task);
  try {
    const response = await fetch('http://localhost:3000/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: task }),
    });
    if (!response.ok) console.error('Failed to submit task:', await response.text());
  } catch (error) {
    console.error('Network error:', error);
  }
});

ipcMain.on('hide-window', () => {
  collapseToAmbient();
});

let resizeAnimTimer: NodeJS.Timeout | null = null;

function cancelResizeAnim() {
  if (resizeAnimTimer) {
    clearInterval(resizeAnimTimer);
    resizeAnimTimer = null;
  }
}

function setSizeImmediate(w: number, h: number) {
  if (!mainWindow) return;
  mainWindow.setSize(w, h);
  native.placeInNotch(mainWindow.getNativeWindowHandle(), w, h);
}

function animateResize(targetW: number, targetH: number, durationMs = 220) {
  if (!mainWindow) return;
  cancelResizeAnim();
  const [startW, startH] = mainWindow.getSize();
  if (startW === targetW && startH === targetH) return;
  const startT = Date.now();

  resizeAnimTimer = setInterval(() => {
    if (!mainWindow) { cancelResizeAnim(); return; }
    const t = Math.min(1, (Date.now() - startT) / durationMs);
    // cubic-bezier(0.22, 1, 0.36, 1) approximation — same easing as CSS
    const e = 1 - Math.pow(1 - t, 3);
    const w = Math.round(startW + (targetW - startW) * e);
    const h = Math.round(startH + (targetH - startH) * e);
    setSizeImmediate(w, h);
    if (t >= 1) cancelResizeAnim();
  }, 16);
}

ipcMain.on('contract-to-notch', () => {
  if (!mainWindow) return;
  cancelResizeAnim();
  // Confirm tick is shown inside the W×H pill area, then renderer asks for hide.
  setSizeImmediate(W, H);
  mainWindow.webContents.send('show-confirm');
});

ipcMain.on('set-size', (_, { w, h }: { w: number; h: number }) => {
  animateResize(w, h);
});

async function pushTasks() {
  try {
    const res = await fetch('http://localhost:3000/api/tasks');
    const data = await res.json() as { tasks?: unknown[] };
    const tasks = (data.tasks ?? []).slice(0, 20);
    mainWindow?.webContents.send('tasks-data', tasks);
  } catch {
    mainWindow?.webContents.send('tasks-data', []);
  }
}

ipcMain.on('fetch-tasks', () => { void pushTasks(); });

// Ambient-dot poll: keep most-recent-task status fresh even when overlay is closed.
setInterval(() => { void pushTasks(); }, 10_000);

ipcMain.on('open-task', (_, id?: string) => {
  const url = id
    ? `http://localhost:3000/#entry-${encodeURIComponent(id)}`
    : 'http://localhost:3000';
  shell.openExternal(url);
});

ipcMain.on('clear-tasks', async (_, target: string) => {
  try {
    const url =
      target === 'thoughts'
        ? 'http://localhost:3000/api/tasks?entry_type=thought'
        : `http://localhost:3000/api/tasks?status=${target}`;
    const res = await fetch(url, { method: 'DELETE' });
    const data = (await res.json()) as { count?: number; error?: string };
    mainWindow?.webContents.send('clear-result', data.count ?? 0);
  } catch {
    mainWindow?.webContents.send('clear-result', -1);
  }
});

import { app, BrowserWindow, ipcMain, screen, shell } from 'electron';
import * as path from 'path';
import { uIOhook, UiohookKey } from 'uiohook-napi';

const native: { placeInNotch: (handle: Buffer, w: number, h: number) => void } =
  require('./build/Release/window_native.node');

let mainWindow: BrowserWindow | null = null;
let openedViaHotkey = false;

const W = 300;
const H = 75;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: W,
    height: H,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    roundedCorners: false,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.loadFile(path.join(__dirname, 'overlay/index.html'));

  // Only hide on blur when the window has focus (user clicked away intentionally)
  mainWindow.on('blur', () => {
    if (mainWindow?.isFocused()) return;
    mainWindow?.hide();
    mainWindow?.webContents.send('did-hide');
  });
}

function showOverlay(grabFocus = false) {
  if (!mainWindow || mainWindow.isVisible()) return;
  openedViaHotkey = grabFocus;

  const display = screen.getPrimaryDisplay();
  const menuBarH = display.workArea.y;
  const x = Math.round(display.bounds.width / 2 - W / 2);

  // Re-assert window level and workspace visibility on every show — macOS can
  // demote the window level after Mission Control / Space switches.
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.show();
  cancelResizeAnim();
  mainWindow.setSize(W, H);
  native.placeInNotch(mainWindow.getNativeWindowHandle(), W, H);

  const actualPos = mainWindow.getPosition();
  const actualSize = mainWindow.getSize();
  require('fs').writeFileSync('/tmp/eva-debug.json', JSON.stringify({
    bounds: display.bounds,
    workArea: display.workArea,
    menuBarH,
    requested: { x, y: menuBarH, w: W, h: H },
    actual: { pos: actualPos, size: actualSize },
  }, null, 2));

  if (grabFocus) mainWindow.focus();
  mainWindow.webContents.send('did-show');
}

function hideOverlay() {
  if (!mainWindow || !mainWindow.isVisible()) return;
  openedViaHotkey = false;
  mainWindow.hide();
  mainWindow.webContents.send('did-hide');
}

app.whenReady().then(() => {
  createWindow();

  const display = screen.getPrimaryDisplay();
  const screenCenterX = display.bounds.width / 2;
  const menuBarH = display.workArea.y;
  // hover zone: notch width ± generous margin, full expanded panel height
  const NOTCH_HALF_W = 140;
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
        if (mainWindow?.isVisible()) hideOverlay();
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
    // activate only when cursor is in the physical notch/menu-bar strip
    const inNotch = withinX && e.y <= menuBarH;

    // stay open while cursor is anywhere over the current window rect
    // (window resizes as the panel expands, so use live bounds — the static
    // HOVER_ZONE_H only covers the collapsed notch + base input row).
    let inPanel: boolean;
    if (mainWindow?.isVisible()) {
      const b = mainWindow.getBounds();
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
      if (!mainWindow?.isVisible() && !hoverEnterTimer) {
        hoverEnterTimer = setTimeout(() => {
          showOverlay(false); // hover: don't steal focus from current app
          hoverEnterTimer = null;
        }, 150);
      }
    } else {
      if (hoverEnterTimer) { clearTimeout(hoverEnterTimer); hoverEnterTimer = null; }
      // don't auto-close if user opened via Ctrl — they're in control
      if (!inPanel && mainWindow?.isVisible() && !openedViaHotkey && !hoverLeaveTimer) {
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
  mainWindow?.hide();
  mainWindow?.webContents.send('did-hide');
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
  setSizeImmediate(W, H);
  mainWindow.webContents.send('show-confirm');
});

ipcMain.on('set-size', (_, { w, h }: { w: number; h: number }) => {
  animateResize(w, h);
});

ipcMain.on('fetch-tasks', async () => {
  try {
    const res = await fetch('http://localhost:3000/api/tasks');
    const data = await res.json() as { tasks?: unknown[] };
    const tasks = (data.tasks ?? []).slice(0, 20);
    mainWindow?.webContents.send('tasks-data', tasks);
  } catch {
    mainWindow?.webContents.send('tasks-data', []);
  }
});

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

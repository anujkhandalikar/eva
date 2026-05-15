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

  mainWindow.show();
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
  uIOhook.on('mousemove', (e) => {
    const withinX = Math.abs(e.x - screenCenterX) <= NOTCH_HALF_W;
    // activate only when cursor is in the physical notch/menu-bar strip
    const inNotch = withinX && e.y <= menuBarH;
    // stay open while cursor is anywhere in the expanded panel too
    const inPanel = withinX && e.y <= HOVER_ZONE_H;

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

ipcMain.on('contract-to-notch', () => {
  if (!mainWindow) return;
  mainWindow.setSize(W, H);
  native.placeInNotch(mainWindow.getNativeWindowHandle(), W, H);
  mainWindow.webContents.send('show-confirm');
});

ipcMain.on('expand-width', (_, width: number) => {
  if (!mainWindow) return;
  const currentH = mainWindow.getSize()[1];
  mainWindow.setSize(width, currentH);
  native.placeInNotch(mainWindow.getNativeWindowHandle(), width, currentH);
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

ipcMain.on('resize-window', (_, height: number) => {
  if (!mainWindow) return;
  mainWindow.setSize(W, height);
  native.placeInNotch(mainWindow.getNativeWindowHandle(), W, height);
});

ipcMain.on('open-task', () => {
  shell.openExternal('http://localhost:3000');
});

ipcMain.on('clear-tasks', async (_, status: string) => {
  try {
    const res = await fetch(`http://localhost:3000/api/tasks?status=${status}`, {
      method: 'DELETE',
    });
    const data = await res.json() as { count?: number; error?: string };
    mainWindow?.webContents.send('clear-result', data.count ?? 0);
  } catch {
    mainWindow?.webContents.send('clear-result', -1);
  }
});

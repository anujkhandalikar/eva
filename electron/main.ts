import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { uIOhook, UiohookKey } from 'uiohook-napi';

// Native addon — sets NSWindow level above menu bar and positions flush in notch
const native: { moveToNotch: (handle: Buffer, w: number, h: number) => void } =
  require('./build/Release/window_native.node');

let mainWindow: BrowserWindow | null = null;
let lastCtrlPressTime = 0;
const DOUBLE_TAP_THRESHOLD = 400;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 50,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
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

  mainWindow.on('blur', () => {
    mainWindow?.hide();
    mainWindow?.webContents.send('did-hide');
  });
}

function toggleOverlay() {
  if (!mainWindow) return;

  if (mainWindow.isVisible()) {
    mainWindow.hide();
    mainWindow.webContents.send('did-hide');
    return;
  }

  const w = 220;
  const h = 46;

  mainWindow.show();
  // Native call bypasses macOS workArea constraint — places window in notch at y=0
  native.moveToNotch(mainWindow.getNativeWindowHandle(), w, h);
  mainWindow.focus();
  mainWindow.webContents.send('did-show');
}

app.whenReady().then(() => {
  createWindow();

  uIOhook.on('keydown', (e) => {
    if (e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight) {
      const now = Date.now();
      if (now - lastCtrlPressTime < DOUBLE_TAP_THRESHOLD) {
        toggleOverlay();
        lastCtrlPressTime = 0;
      } else {
        lastCtrlPressTime = now;
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
  mainWindow.setSize(220, 46);
  mainWindow.webContents.send('show-confirm');
});

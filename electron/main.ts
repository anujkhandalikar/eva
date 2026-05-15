import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { uIOhook, UiohookKey } from 'uiohook-napi';

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

  const display = screen.getPrimaryDisplay();
  const menuBarH = display.workArea.y; // ~37px on MacBook Pro with notch
  const w = 220;
  const h = menuBarH + 22;             // half the previous overhang

  // show first — macOS ignores setBounds on hidden windows
  mainWindow.show();
  mainWindow.setPosition(
    Math.round(display.bounds.width / 2 - w / 2),
    0,                                 // flush against the very top
  );
  mainWindow.setSize(w, h);
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
});

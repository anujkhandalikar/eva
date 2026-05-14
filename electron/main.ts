import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import { uIOhook, UiohookKey } from 'uiohook-napi';

let mainWindow: BrowserWindow | null = null;
let lastCtrlPressTime = 0;
const DOUBLE_TAP_THRESHOLD = 400; // ms

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 60,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    show: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Make window appear on ALL Spaces so it never triggers a Space switch
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.loadFile(path.join(__dirname, 'overlay/index.html'));

  mainWindow.on('blur', () => {
    mainWindow?.hide();
  });
}

function toggleOverlay() {
  if (mainWindow) {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      // Show first, then reposition — macOS ignores setPosition on hidden windows
      mainWindow.show();

      const cursorPoint = screen.getCursorScreenPoint();
      const activeDisplay = screen.getDisplayNearestPoint(cursorPoint);
      const { x, y, width } = activeDisplay.workArea;
      const winWidth = 600;
      mainWindow.setPosition(
        Math.round(x + width / 2 - winWidth / 2),
        Math.round(y + 120)
      );

      mainWindow.focus();
    }
  }
}

app.whenReady().then(() => {
  createWindow();

  // Listen for double tap Control using uiohook-napi
  // (native addon that runs inside Electron process — no separate binary needed)
  uIOhook.on('keydown', (e) => {
    if (e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight) {
      const now = Date.now();
      if (now - lastCtrlPressTime < DOUBLE_TAP_THRESHOLD) {
        toggleOverlay();
        lastCtrlPressTime = 0; // reset to prevent triple-tap triggering twice
      } else {
        lastCtrlPressTime = now;
      }
    }
  });

  uIOhook.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
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
    
    if (!response.ok) {
      console.error('Failed to submit task:', await response.text());
    } else {
      console.log('Successfully submitted task');
    }
  } catch (error) {
    console.error('Network error:', error);
  }
});

ipcMain.on('hide-window', () => {
  mainWindow?.hide();
});

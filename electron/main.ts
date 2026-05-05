import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { GlobalKeyboardListener } from 'node-global-key-listener';

let mainWindow: BrowserWindow | null = null;
let lastCtrlPressTime = 0;
const DOUBLE_TAP_THRESHOLD = 400; // ms

// Initialize the global listener
const keyboardListener = new GlobalKeyboardListener();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 60,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    show: false,
    center: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

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
      mainWindow.show();
      mainWindow.focus();
    }
  }
}

app.whenReady().then(() => {
  createWindow();

  // Listen for double tap Control
  keyboardListener.addListener((e) => {
    if (e.state === "DOWN" && (e.name === "LEFT CTRL" || e.name === "RIGHT CTRL")) {
      const now = Date.now();
      if (now - lastCtrlPressTime < DOUBLE_TAP_THRESHOLD) {
        toggleOverlay();
        lastCtrlPressTime = 0; // reset to prevent triple-tap triggering twice
      } else {
        lastCtrlPressTime = now;
      }
    }
  });

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
  // GlobalKeyboardListener cleans itself up, but we could forcefully kill it if needed.
});

ipcMain.on('submit-task', (event, task) => {
  console.log('Task captured:', task);
  mainWindow?.hide();
});

ipcMain.on('hide-window', () => {
  mainWindow?.hide();
});

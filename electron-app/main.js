"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const uiohook_napi_1 = require("uiohook-napi");
let mainWindow = null;
let lastCtrlPressTime = 0;
const DOUBLE_TAP_THRESHOLD = 400; // ms
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
        }
        else {
            // Show first, then reposition — macOS ignores setPosition on hidden windows
            mainWindow.show();
            const cursorPoint = electron_1.screen.getCursorScreenPoint();
            const activeDisplay = electron_1.screen.getDisplayNearestPoint(cursorPoint);
            const { x, y, width } = activeDisplay.workArea;
            const winWidth = 600;
            mainWindow.setPosition(Math.round(x + width / 2 - winWidth / 2), Math.round(y + 120));
            mainWindow.focus();
        }
    }
}
electron_1.app.whenReady().then(() => {
    createWindow();
    // Listen for double tap Control using uiohook-napi
    // (native addon that runs inside Electron process — no separate binary needed)
    uiohook_napi_1.uIOhook.on('keydown', (e) => {
        if (e.keycode === uiohook_napi_1.UiohookKey.Ctrl || e.keycode === uiohook_napi_1.UiohookKey.CtrlRight) {
            const now = Date.now();
            if (now - lastCtrlPressTime < DOUBLE_TAP_THRESHOLD) {
                toggleOverlay();
                lastCtrlPressTime = 0; // reset to prevent triple-tap triggering twice
            }
            else {
                lastCtrlPressTime = now;
            }
        }
    });
    uiohook_napi_1.uIOhook.start();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('will-quit', () => {
    uiohook_napi_1.uIOhook.stop();
});
electron_1.ipcMain.on('submit-task', async (event, task) => {
    console.log('Task captured:', task);
    mainWindow?.hide();
    try {
        const response = await fetch('http://localhost:3000/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ input: task }),
        });
        if (!response.ok) {
            console.error('Failed to submit task:', await response.text());
        }
        else {
            console.log('Successfully submitted task');
        }
    }
    catch (error) {
        console.error('Network error:', error);
    }
});
electron_1.ipcMain.on('hide-window', () => {
    mainWindow?.hide();
});

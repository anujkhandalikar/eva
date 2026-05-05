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
const node_global_key_listener_1 = require("node-global-key-listener");
let mainWindow = null;
let lastCtrlPressTime = 0;
const DOUBLE_TAP_THRESHOLD = 400; // ms
// Initialize the global listener
const keyboardListener = new node_global_key_listener_1.GlobalKeyboardListener();
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
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
        }
        else {
            mainWindow.show();
            mainWindow.focus();
        }
    }
}
electron_1.app.whenReady().then(() => {
    createWindow();
    // Listen for double tap Control
    keyboardListener.addListener((e) => {
        if (e.state === "DOWN" && (e.name === "LEFT CTRL" || e.name === "RIGHT CTRL")) {
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
    // GlobalKeyboardListener cleans itself up, but we could forcefully kill it if needed.
});
electron_1.ipcMain.on('submit-task', (event, task) => {
    console.log('Task captured:', task);
    mainWindow?.hide();
});
electron_1.ipcMain.on('hide-window', () => {
    mainWindow?.hide();
});

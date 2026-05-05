"use strict";
const { ipcRenderer } = require('electron');
const input = document.getElementById('taskInput');
// Focus on window show
window.addEventListener('focus', () => {
    input.focus();
});
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const task = input.value.trim();
        if (task) {
            ipcRenderer.send('submit-task', task);
            input.value = ''; // clear for next time
        }
    }
    else if (e.key === 'Escape') {
        ipcRenderer.send('hide-window');
        input.value = '';
    }
});

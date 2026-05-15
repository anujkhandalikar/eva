"use strict";
const { ipcRenderer } = require('electron');
const pill = document.getElementById('pill');
const input = document.getElementById('taskInput');
const notchConfirm = document.getElementById('notchConfirm');
const confettiCanvas = document.getElementById('confetti');
const ctx = confettiCanvas.getContext('2d');
const browseBtn = document.getElementById('browseBtn');
const browseBadge = document.getElementById('browseBadge');
const taskList = document.getElementById('taskList');
const measureSpan = document.getElementById('inputMeasure');
const tabTasks = document.getElementById('tabTasks');
const tabThoughts = document.getElementById('tabThoughts');
const BASE_H = 75;
const BASE_W = 300;
const MAX_W = 620;
const INPUT_OVERHEAD = 82; // left-pad + right-pad + gap + browse-btn + buffer
const ROW_H = 30;
const TAB_BAR_H = 34; // tabs row padding + content
const PANEL_EXTRA = 20 + TAB_BAR_H; // separator + list padding + tab bar
const MAX_H = 285; // cap — panel scrolls beyond this
const THOUGHTS_VISIBLE_LIMIT = 10;
function updateWidth() {
    measureSpan.textContent = input.value;
    const textW = measureSpan.offsetWidth;
    const newW = Math.min(Math.max(BASE_W, textW + INPUT_OVERHEAD), MAX_W);
    ipcRenderer.send('expand-width', newW);
}
function resetWidth() {
    ipcRenderer.send('expand-width', BASE_W);
}
let browseOpen = false;
let pendingBrowseOpen = false;
let storedTasks = [];
let activeTab = 'tasks';
function isThought(t) {
    return t.entry_type === 'thought';
}
function splitEntries(entries) {
    const tasks = [];
    const thoughts = [];
    for (const e of entries) {
        if (isThought(e))
            thoughts.push(e);
        else
            tasks.push(e);
    }
    return { tasks, thoughts };
}
// ── Placeholders ──
const placeholders = [
    "Unleash me…",
    "I don't sleep. You do.",
    "Feed me a task.",
    "I'm bored. Fix that.",
    "Do your worst.",
    "Go on then.",
    "I've been waiting.",
    "Another one? Let's go.",
    "Brain full? Offload.",
    "I live for this.",
    "Say the thing.",
    "I'm faster than you.",
    "Speak.",
    "Hit me.",
    "No task too cursed.",
    "Finally.",
    "Clock's ticking.",
    "Bold of you to need help.",
    "I've seen worse. Probably.",
    "Task or I riot.",
];
let placeholderIndex = 0;
// ── Show / hide ──
ipcRenderer.on('did-show', () => {
    notchConfirm.className = 'notch-confirm';
    const textEl = notchConfirm.querySelector('.text');
    if (textEl)
        textEl.textContent = 'Captured';
    input.value = '';
    input.classList.remove('has-text');
    placeholderIndex = (placeholderIndex + 1) % placeholders.length;
    input.placeholder = placeholders[placeholderIndex];
    pill.classList.remove('drop', 'collapse');
    void pill.offsetHeight;
    pill.classList.add('drop');
    // close browse silently (no animation) since window just opened
    browseOpen = false;
    pendingBrowseOpen = false;
    browseBtn.classList.remove('active');
    setTimeout(() => input.focus(), 60);
    // fetch tasks for badge
    ipcRenderer.send('fetch-tasks');
});
ipcRenderer.on('did-hide', () => {
    input.value = '';
    input.classList.remove('has-text');
    pill.classList.remove('drop', 'collapse');
    browseOpen = false;
    pendingBrowseOpen = false;
    browseBtn.classList.remove('active');
    resetWidth();
});
// ── Notch confirm ──
ipcRenderer.on('show-confirm', () => {
    notchConfirm.className = 'notch-confirm';
    void notchConfirm.offsetHeight;
    notchConfirm.classList.add('show');
    setTimeout(() => ipcRenderer.send('hide-window'), 1650);
});
// ── Tasks data ──
ipcRenderer.on('tasks-data', (_, tasks) => {
    storedTasks = tasks;
    updateBadge(tasks);
    if (pendingBrowseOpen) {
        pendingBrowseOpen = false;
        openBrowse(tasks);
    }
});
function updateBadge(entries) {
    const tasks = entries.filter(e => !isThought(e));
    const actionable = tasks.filter(t => t.status === 'needs_approval' || t.status === 'failed').length;
    const hasRunning = tasks.some(t => t.status === 'running' || t.status === 'pending');
    const hasTasks = entries.length > 0;
    browseBtn.classList.toggle('has-tasks', hasTasks);
    if (actionable > 0) {
        browseBadge.textContent = String(actionable);
        browseBadge.classList.add('visible');
        browseBadge.classList.remove('pulse');
    }
    else if (hasRunning) {
        browseBadge.textContent = '';
        browseBadge.classList.add('visible', 'pulse');
    }
    else {
        browseBadge.textContent = '';
        browseBadge.classList.remove('visible', 'pulse');
    }
}
function timeAgo(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)
        return 'now';
    if (diff < 3600)
        return `${Math.floor(diff / 60)}m`;
    if (diff < 86400)
        return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
}
function renderTaskList(tasks) {
    taskList.innerHTML = '';
    if (tasks.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'panel-empty';
        empty.textContent = 'No tasks yet.';
        taskList.appendChild(empty);
        return;
    }
    tasks.forEach(task => {
        const row = document.createElement('div');
        row.className = 'task-row';
        const dot = document.createElement('div');
        dot.className = `status-dot ${task.status}`;
        const name = document.createElement('div');
        name.className = 'task-name';
        name.textContent = task.input;
        const time = document.createElement('div');
        time.className = 'task-time';
        time.textContent = timeAgo(task.created_at);
        row.appendChild(dot);
        row.appendChild(name);
        row.appendChild(time);
        row.addEventListener('click', () => {
            ipcRenderer.send('open-task', task.id);
        });
        taskList.appendChild(row);
    });
}
function renderThoughtList(thoughts) {
    taskList.innerHTML = '';
    if (thoughts.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'panel-empty';
        empty.textContent = 'No thoughts captured yet.';
        taskList.appendChild(empty);
        return;
    }
    const visible = thoughts.slice(0, THOUGHTS_VISIBLE_LIMIT);
    visible.forEach(thought => {
        const row = document.createElement('div');
        row.className = 'thought-row';
        const name = document.createElement('div');
        name.className = 'task-name';
        name.textContent = thought.input;
        const time = document.createElement('div');
        time.className = 'task-time';
        time.textContent = timeAgo(thought.created_at);
        row.appendChild(name);
        row.appendChild(time);
        row.addEventListener('click', () => {
            ipcRenderer.send('open-task', thought.id);
        });
        taskList.appendChild(row);
    });
    if (thoughts.length > THOUGHTS_VISIBLE_LIMIT) {
        const footer = document.createElement('div');
        footer.className = 'thought-footer';
        footer.textContent = `… ${thoughts.length - THOUGHTS_VISIBLE_LIMIT} more on dashboard`;
        footer.addEventListener('click', () => {
            ipcRenderer.send('open-task', '');
        });
        taskList.appendChild(footer);
    }
}
const STATUS_PRIORITY = {
    needs_approval: 0,
    running: 1,
    pending: 1,
    failed: 2,
    done: 3,
    captured: 4,
};
function sortByUrgency(tasks) {
    return [...tasks].sort((a, b) => {
        const pd = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
        if (pd !== 0)
            return pd;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}
function sortByRecency(entries) {
    return [...entries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
function browseHeight(rowCount) {
    return Math.min(BASE_H + PANEL_EXTRA + Math.max(rowCount, 1) * ROW_H, MAX_H);
}
function renderActiveTab() {
    tabTasks.classList.toggle('active', activeTab === 'tasks');
    tabThoughts.classList.toggle('active', activeTab === 'thoughts');
    const { tasks, thoughts } = splitEntries(storedTasks);
    if (activeTab === 'tasks') {
        renderTaskList(sortByUrgency(tasks));
        return tasks.length;
    }
    else {
        const sorted = sortByRecency(thoughts);
        renderThoughtList(sorted);
        const visible = Math.min(sorted.length, THOUGHTS_VISIBLE_LIMIT);
        const footer = sorted.length > THOUGHTS_VISIBLE_LIMIT ? 1 : 0;
        return visible + footer;
    }
}
function openBrowse(entries) {
    browseOpen = true;
    browseBtn.classList.add('active');
    storedTasks = entries;
    const visibleRows = renderActiveTab();
    ipcRenderer.send('resize-window', browseHeight(visibleRows));
}
tabTasks.addEventListener('click', () => {
    if (activeTab === 'tasks')
        return;
    activeTab = 'tasks';
    if (browseOpen) {
        const visibleRows = renderActiveTab();
        ipcRenderer.send('resize-window', browseHeight(visibleRows));
    }
});
tabThoughts.addEventListener('click', () => {
    if (activeTab === 'thoughts')
        return;
    activeTab = 'thoughts';
    if (browseOpen) {
        const visibleRows = renderActiveTab();
        ipcRenderer.send('resize-window', browseHeight(visibleRows));
    }
});
function closeBrowse() {
    browseOpen = false;
    browseBtn.classList.remove('active');
    ipcRenderer.send('resize-window', BASE_H);
}
// ── Browse button toggle ──
browseBtn.addEventListener('click', () => {
    if (browseOpen) {
        closeBrowse();
    }
    else {
        pendingBrowseOpen = true;
        ipcRenderer.send('fetch-tasks');
    }
});
// ── Input handlers ──
input.addEventListener('input', () => {
    input.classList.toggle('has-text', input.value.length > 0);
    updateWidth();
});
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')
        submit();
    else if (e.key === 'Escape')
        dismiss();
});
function dismiss() {
    if (browseOpen) {
        closeBrowse();
        return;
    }
    resetWidth();
    pill.classList.remove('drop');
    void pill.offsetHeight;
    pill.classList.add('collapse');
    setTimeout(() => ipcRenderer.send('hide-window'), 230);
}
const COLORS = ['#dc2626', '#ef4444', '#f87171', '#fca5a5', '#b91c1c', '#ff6b8a', '#fff1f2'];
let particles = [];
let animFrame = null;
function spawnConfetti() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    const w = confettiCanvas.width;
    const h = confettiCanvas.height;
    particles = Array.from({ length: 28 }, () => ({
        x: w / 2 + (Math.random() - 0.5) * 80,
        y: h / 2,
        vx: (Math.random() - 0.5) * 5,
        vy: -(Math.random() * 3 + 1),
        size: Math.random() * 4 + 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 0, maxLife: Math.random() * 25 + 30,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
    }));
    function draw() {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        particles = particles.filter(p => p.life < p.maxLife);
        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.15;
            p.rotation += p.rotationSpeed;
            p.life++;
            ctx.save();
            ctx.globalAlpha = 1 - p.life / p.maxLife;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            ctx.restore();
        }
        if (particles.length > 0)
            animFrame = requestAnimationFrame(draw);
        else
            ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
    if (animFrame)
        cancelAnimationFrame(animFrame);
    draw();
}
// ── Commands ──
const COMMANDS = {
    '/clear failed': { target: 'failed', label: 'Cleared' },
    '/clear done': { target: 'done', label: 'Cleared' },
    '/clear pending': { target: 'pending', label: 'Cleared' },
    '/clear thoughts': { target: 'thoughts', label: 'Cleared' },
};
ipcRenderer.on('clear-result', (_, count) => {
    collapseAndConfirm(count < 0 ? 'Error' : count === 0 ? 'Nothing to clear' : `Cleared ${count}`);
});
function collapseAndConfirm(message) {
    const textEl = notchConfirm.querySelector('.text');
    if (textEl)
        textEl.textContent = message;
    if (browseOpen) {
        browseOpen = false;
        browseBtn.classList.remove('active');
    }
    resetWidth();
    pill.classList.remove('drop');
    void pill.offsetHeight;
    pill.classList.add('collapse');
    setTimeout(() => ipcRenderer.send('contract-to-notch'), 110);
}
// ── Submit ──
function submit() {
    const raw = input.value.trim();
    if (!raw)
        return;
    input.value = '';
    input.classList.remove('has-text');
    const cmd = COMMANDS[raw.toLowerCase()];
    if (cmd) {
        ipcRenderer.send('clear-tasks', cmd.target);
        return;
    }
    if (raw.startsWith('/')) {
        collapseAndConfirm('Unknown command');
        return;
    }
    spawnConfetti();
    ipcRenderer.send('submit-task', raw);
    if (browseOpen) {
        browseOpen = false;
        browseBtn.classList.remove('active');
    }
    pill.classList.remove('drop');
    void pill.offsetHeight;
    pill.classList.add('collapse');
    setTimeout(() => ipcRenderer.send('contract-to-notch'), 110);
}

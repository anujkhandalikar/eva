"use strict";
const { ipcRenderer } = require('electron');
const pill = document.getElementById('pill');
const input = document.getElementById('taskInput');
const notchConfirm = document.getElementById('notchConfirm');
const confettiCanvas = document.getElementById('confetti');
const ctx = confettiCanvas.getContext('2d');
const screenshotBtn = document.getElementById('screenshotBtn');
const browseBtn = document.getElementById('browseBtn');
const browseBadge = document.getElementById('browseBadge');
const taskList = document.getElementById('taskList');
const measureSpan = document.getElementById('inputMeasure');
const tabTasks = document.getElementById('tabTasks');
const tabThoughts = document.getElementById('tabThoughts');
const ambientDot = document.getElementById('ambientDot');
const imageChip = document.getElementById('imageChip');
const imageChipClear = document.getElementById('imageChipClear');
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
let pendingImage = null;
const BASE_H = 68;
const EXPANDED_H = 68;
const BASE_W = 300;
const EXPANDED_W = 480;
const MAX_W = 900;
const WING_W = 24; // 12px outward corner on each side
const INPUT_OVERHEAD = 112; // left-pad + right-pad + gap + buttons + buffer
const ROW_H = 30;
const TAB_BAR_H = 34; // tabs row padding + content
const PANEL_EXTRA = 20 + TAB_BAR_H; // separator + list padding + tab bar
const MAX_H = 360; // cap — panel scrolls beyond this
const VISIBLE_LIMIT = 5;
let inputExpanded = false;
function inputHeight() {
    return inputExpanded ? EXPANDED_H : BASE_H;
}
function currentWidth() {
    measureSpan.textContent = input.value;
    const textW = measureSpan.offsetWidth;
    const floor = inputExpanded ? EXPANDED_W : BASE_W;
    return Math.min(Math.max(floor, textW + INPUT_OVERHEAD), MAX_W);
}
function updateSize() {
    ipcRenderer.send('set-size', { w: currentWidth() + WING_W, h: inputHeight() });
}
function expandInput() {
    if (inputExpanded)
        return;
    inputExpanded = true;
    pill.classList.add('expanded');
}
function resetSize() {
    inputExpanded = false;
    pill.classList.remove('expanded');
    ipcRenderer.send('set-size', { w: BASE_W + WING_W, h: BASE_H });
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
function showImageChip(image) {
    pendingImage = image;
    imageChip.style.backgroundImage = `url("${image.previewUrl}")`;
    imageChip.classList.add('visible');
    imageChip.title = image.name;
    expandInput();
    updateSize();
}
function clearImageChip() {
    if (pendingImage) {
        URL.revokeObjectURL(pendingImage.previewUrl);
        pendingImage = null;
    }
    imageChip.classList.remove('visible');
    imageChip.style.backgroundImage = '';
    imageChip.removeAttribute('title');
    updateSize();
}
imageChipClear.addEventListener('click', (e) => {
    e.stopPropagation();
    clearImageChip();
});
async function attachImageBlob(blob, name) {
    if (!blob.type.startsWith('image/'))
        return;
    if (blob.size > MAX_IMAGE_BYTES) {
        collapseAndConfirm('Image too big');
        return;
    }
    const buffer = await blob.arrayBuffer();
    const previewBlob = new Blob([buffer], { type: blob.type });
    const previewUrl = URL.createObjectURL(previewBlob);
    if (pendingImage)
        URL.revokeObjectURL(pendingImage.previewUrl);
    showImageChip({ buffer, type: blob.type, name, previewUrl });
}
// ── Drag-drop image — scoped to .pill so body drag region stays intact ──
pill.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer)
        e.dataTransfer.dropEffect = 'copy';
    pill.classList.add('drag-over');
});
pill.addEventListener('dragleave', (e) => {
    if (!pill.contains(e.relatedTarget)) {
        pill.classList.remove('drag-over');
    }
});
pill.addEventListener('drop', async (e) => {
    e.preventDefault();
    pill.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file)
        await attachImageBlob(file, file.name);
});
// ── Clipboard paste — image becomes chip, text falls through to input ──
input.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items)
        return;
    for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
            e.preventDefault();
            const blob = item.getAsFile();
            if (!blob)
                return;
            const ext = (blob.type.split('/')[1] ?? 'png').replace(/[^a-z0-9]/gi, '') || 'png';
            void attachImageBlob(blob, `pasted-${Date.now()}.${ext}`);
            return;
        }
    }
    // No image in clipboard — let the default paste insert text into input.
});
// ── Show / hide ──
ipcRenderer.on('did-show', () => {
    document.body.classList.add('overlay-open');
    notchConfirm.className = 'notch-confirm';
    const textEl = notchConfirm.querySelector('.text');
    if (textEl)
        textEl.textContent = 'Captured';
    // Preserve text + image across hover-close. Only re-rotate placeholder when
    // there's no draft to show.
    const hasDraft = input.value.length > 0 || pendingImage !== null;
    if (!hasDraft) {
        placeholderIndex = (placeholderIndex + 1) % placeholders.length;
        input.placeholder = placeholders[placeholderIndex];
    }
    else {
        input.classList.toggle('has-text', input.value.length > 0);
        expandInput();
        // Re-emit size so main grows the window past the default open dims.
        updateSize();
    }
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
    document.body.classList.remove('overlay-open');
    // State is preserved across hover-close. Text + pending image survive so the
    // user picks up where they left off on re-hover. Only ephemeral UI bits reset.
    pill.classList.remove('drop', 'collapse');
    browseOpen = false;
    pendingBrowseOpen = false;
    browseBtn.classList.remove('active');
});
// notch-height IPC kept for future use; dot now positions via CSS centering.
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
    updateAmbientDot(tasks);
    if (pendingBrowseOpen) {
        pendingBrowseOpen = false;
        openBrowse(tasks);
    }
});
// ── Ambient dot — most-recent non-thought task. Always reflects the latest
// task's current status so the user sees the thing they just queued. ──
const DONE_MAX_VISIBLE_MS = 1 * 60 * 1000;
const DONE_STORAGE_KEY = 'ambient:done';
const AMBIENT_STATUSES = new Set([
    'pending', 'running', 'done', 'needs_approval', 'needs_otp', 'failed', 'captured',
]);
let ambientTaskId = null;
let ambientDoneShownAt = null;
let doneHideTimer = null;
function readDoneSnapshot() {
    try {
        const raw = localStorage.getItem(DONE_STORAGE_KEY);
        if (!raw)
            return null;
        const parsed = JSON.parse(raw);
        if (typeof parsed?.id === 'string' && typeof parsed?.ts === 'number') {
            return { id: parsed.id, ts: parsed.ts };
        }
        return null;
    }
    catch {
        return null;
    }
}
function writeDoneSnapshot(id, ts) {
    try {
        localStorage.setItem(DONE_STORAGE_KEY, JSON.stringify({ id, ts }));
    }
    catch { /* quota / disabled */ }
}
function clearDoneSnapshot() {
    try {
        localStorage.removeItem(DONE_STORAGE_KEY);
    }
    catch { /* disabled */ }
}
function hideAmbientDot() {
    ambientDot.hidden = true;
    ambientDot.removeAttribute('data-status');
    ambientTaskId = null;
    ambientDoneShownAt = null;
}
function updateAmbientDot(entries) {
    if (doneHideTimer !== null) {
        clearTimeout(doneHideTimer);
        doneHideTimer = null;
    }
    const tasks = entries.filter(e => !isThought(e));
    const sorted = sortByRecency(tasks);
    const latest = sorted[0];
    if (!latest || !AMBIENT_STATUSES.has(latest.status)) {
        hideAmbientDot();
        clearDoneSnapshot();
        return;
    }
    const taskChanged = latest.id !== ambientTaskId;
    if (taskChanged) {
        ambientTaskId = latest.id;
        if (latest.status === 'done') {
            // Only show if we have a stored timestamp — no ts means the window already
            // expired and was cleared, so don't restart the timer on restart.
            const stored = readDoneSnapshot();
            if (stored && stored.id === latest.id) {
                ambientDoneShownAt = stored.ts;
            }
            else {
                ambientDoneShownAt = null;
            }
        }
        else {
            ambientDoneShownAt = null;
            clearDoneSnapshot();
        }
    }
    else if (latest.status === 'done' && ambientDoneShownAt === null) {
        ambientDoneShownAt = Date.now();
        writeDoneSnapshot(latest.id, ambientDoneShownAt);
    }
    else if (latest.status !== 'done') {
        ambientDoneShownAt = null;
        clearDoneSnapshot();
    }
    if (latest.status === 'done') {
        if (ambientDoneShownAt === null) {
            hideAmbientDot();
            return;
        }
        const age = Date.now() - ambientDoneShownAt;
        if (age >= DONE_MAX_VISIBLE_MS) {
            hideAmbientDot();
            clearDoneSnapshot();
            return;
        }
        // Self-fire the hide check even when no new task data arrives.
        doneHideTimer = setTimeout(() => updateAmbientDot(storedTasks), DONE_MAX_VISIBLE_MS - age);
    }
    ambientDot.hidden = false;
    ambientDot.dataset.status = latest.status;
}
ambientDot.addEventListener('click', () => {
    if (ambientTaskId)
        ipcRenderer.send('open-task', ambientTaskId);
});
function updateBadge(entries) {
    const tasks = entries.filter(e => !isThought(e));
    const actionable = tasks.filter(t => t.status === 'needs_approval' || t.status === 'failed').length;
    const hasTasks = entries.length > 0;
    browseBtn.classList.toggle('has-tasks', hasTasks);
    if (actionable > 0) {
        browseBadge.textContent = String(actionable);
        browseBadge.classList.add('visible');
        browseBadge.classList.remove('pulse');
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
    const visible = tasks.slice(0, VISIBLE_LIMIT);
    visible.forEach(task => {
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
    if (tasks.length > VISIBLE_LIMIT) {
        const footer = document.createElement('div');
        footer.className = 'thought-footer';
        footer.textContent = 'more';
        footer.addEventListener('click', () => {
            ipcRenderer.send('open-bento');
        });
        taskList.appendChild(footer);
    }
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
    const visible = thoughts.slice(0, VISIBLE_LIMIT);
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
    if (thoughts.length > VISIBLE_LIMIT) {
        const footer = document.createElement('div');
        footer.className = 'thought-footer';
        footer.textContent = 'more';
        footer.addEventListener('click', () => {
            ipcRenderer.send('open-bento');
        });
        taskList.appendChild(footer);
    }
}
function sortByRecency(entries) {
    return [...entries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
function browseHeight(rowCount) {
    return Math.min(inputHeight() + PANEL_EXTRA + Math.max(rowCount, 1) * ROW_H, MAX_H);
}
function renderActiveTab() {
    tabTasks.classList.toggle('active', activeTab === 'tasks');
    tabThoughts.classList.toggle('active', activeTab === 'thoughts');
    const { tasks, thoughts } = splitEntries(storedTasks);
    if (activeTab === 'tasks') {
        const sorted = sortByRecency(tasks);
        renderTaskList(sorted);
        const visible = Math.min(sorted.length, VISIBLE_LIMIT);
        const footer = sorted.length > VISIBLE_LIMIT ? 1 : 0;
        return visible + footer;
    }
    else {
        const sorted = sortByRecency(thoughts);
        renderThoughtList(sorted);
        const visible = Math.min(sorted.length, VISIBLE_LIMIT);
        const footer = sorted.length > VISIBLE_LIMIT ? 1 : 0;
        return visible + footer;
    }
}
function openBrowse(entries) {
    browseOpen = true;
    browseBtn.classList.add('active');
    storedTasks = entries;
    const visibleRows = renderActiveTab();
    ipcRenderer.send('set-size', { w: currentWidth() + WING_W, h: browseHeight(visibleRows) });
}
tabTasks.addEventListener('click', () => {
    if (activeTab === 'tasks')
        return;
    activeTab = 'tasks';
    if (browseOpen) {
        const visibleRows = renderActiveTab();
        ipcRenderer.send('set-size', { w: currentWidth() + WING_W, h: browseHeight(visibleRows) });
    }
});
tabThoughts.addEventListener('click', () => {
    if (activeTab === 'thoughts')
        return;
    activeTab = 'thoughts';
    if (browseOpen) {
        const visibleRows = renderActiveTab();
        ipcRenderer.send('set-size', { w: currentWidth() + WING_W, h: browseHeight(visibleRows) });
    }
});
function closeBrowse() {
    browseOpen = false;
    browseBtn.classList.remove('active');
    ipcRenderer.send('set-size', { w: currentWidth() + WING_W, h: inputHeight() });
}
// ── Screenshot button ──
screenshotBtn.addEventListener('click', async () => {
    if (screenshotBtn.classList.contains('in-flight'))
        return;
    screenshotBtn.classList.add('in-flight');
    try {
        const buffer = await ipcRenderer.invoke('screenshot:capture');
        if (buffer) {
            const blob = new Blob([buffer], { type: 'image/png' });
            await attachImageBlob(blob, `screenshot-${Date.now()}.png`);
        }
        else {
            collapseAndConfirm('Capture Failed');
        }
    }
    catch (err) {
        console.error('Screenshot failed', err);
        collapseAndConfirm('Capture Error');
    }
    finally {
        screenshotBtn.classList.remove('in-flight');
    }
});
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
    const hasText = input.value.length > 0;
    input.classList.toggle('has-text', hasText);
    if (hasText)
        expandInput();
    updateSize();
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
    // Esc abandons the draft. Wipe text + image so re-hover starts fresh.
    input.value = '';
    input.classList.remove('has-text');
    if (pendingImage) {
        URL.revokeObjectURL(pendingImage.previewUrl);
        pendingImage = null;
    }
    imageChip.classList.remove('visible');
    imageChip.style.backgroundImage = '';
    imageChip.removeAttribute('title');
    resetSize();
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
    resetSize();
    pill.classList.remove('drop');
    void pill.offsetHeight;
    pill.classList.add('collapse');
    setTimeout(() => ipcRenderer.send('contract-to-notch'), 110);
}
// ── Submit ──
function submit() {
    const raw = input.value.trim();
    const hasImage = pendingImage !== null;
    if (!raw && !hasImage)
        return;
    input.value = '';
    input.classList.remove('has-text');
    // Commands ignore image attachment.
    const cmd = COMMANDS[raw.toLowerCase()];
    if (cmd) {
        clearImageChip();
        ipcRenderer.send('clear-tasks', cmd.target);
        return;
    }
    if (raw.startsWith('/')) {
        clearImageChip();
        collapseAndConfirm('Unknown command');
        return;
    }
    spawnConfetti();
    if (hasImage && pendingImage) {
        ipcRenderer.send('submit-task', {
            input: raw,
            image: {
                buffer: pendingImage.buffer,
                type: pendingImage.type,
                name: pendingImage.name,
            },
        });
    }
    else {
        ipcRenderer.send('submit-task', raw);
    }
    clearImageChip();
    if (browseOpen) {
        browseOpen = false;
        browseBtn.classList.remove('active');
    }
    pill.classList.remove('drop');
    void pill.offsetHeight;
    pill.classList.add('collapse');
    setTimeout(() => ipcRenderer.send('contract-to-notch'), 110);
}

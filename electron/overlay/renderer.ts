const { ipcRenderer } = require('electron');

interface Task {
  id: string;
  created_at: string;
  input: string;
  status: 'pending' | 'running' | 'done' | 'needs_approval' | 'failed';
  result_summary: string | null;
  requires_approval: boolean;
  approved: boolean;
}

const pill         = document.getElementById('pill') as HTMLDivElement;
const input        = document.getElementById('taskInput') as HTMLInputElement;
const notchConfirm = document.getElementById('notchConfirm') as HTMLDivElement;
const confettiCanvas = document.getElementById('confetti') as HTMLCanvasElement;
const ctx          = confettiCanvas.getContext('2d')!;
const browseBtn    = document.getElementById('browseBtn') as HTMLButtonElement;
const browseBadge  = document.getElementById('browseBadge') as HTMLSpanElement;
const taskList     = document.getElementById('taskList') as HTMLDivElement;

const BASE_H      = 75;
const ROW_H       = 30;
const PANEL_EXTRA = 20; // separator + list padding

let browseOpen       = false;
let pendingBrowseOpen = false;
let storedTasks: Task[] = [];

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
});

// ── Notch confirm ──
ipcRenderer.on('show-confirm', () => {
  notchConfirm.className = 'notch-confirm';
  void notchConfirm.offsetHeight;
  notchConfirm.classList.add('show');
  setTimeout(() => ipcRenderer.send('hide-window'), 1650);
});

// ── Tasks data ──
ipcRenderer.on('tasks-data', (_: unknown, tasks: Task[]) => {
  storedTasks = tasks;
  updateBadge(tasks);
  if (pendingBrowseOpen) {
    pendingBrowseOpen = false;
    openBrowse(tasks);
  }
});

function updateBadge(tasks: Task[]) {
  const count = tasks.length;
  const hasRunning = tasks.some(t => t.status === 'running' || t.status === 'pending');

  if (count === 0) {
    browseBtn.classList.remove('has-tasks');
    browseBadge.classList.remove('visible', 'pulse');
    browseBadge.textContent = '';
    return;
  }

  browseBtn.classList.add('has-tasks');
  browseBadge.textContent = String(count);
  browseBadge.classList.add('visible');

  if (hasRunning) browseBadge.classList.add('pulse');
  else browseBadge.classList.remove('pulse');
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)   return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function renderTaskList(tasks: Task[]) {
  taskList.innerHTML = '';
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

function browseHeight(count: number): number {
  return BASE_H + PANEL_EXTRA + Math.min(count, 5) * ROW_H;
}

function openBrowse(tasks: Task[]) {
  browseOpen = true;
  browseBtn.classList.add('active');
  renderTaskList(tasks);
  ipcRenderer.send('resize-window', browseHeight(tasks.length));
}

function closeBrowse() {
  browseOpen = false;
  browseBtn.classList.remove('active');
  ipcRenderer.send('resize-window', BASE_H);
}

// ── Browse button toggle ──
browseBtn.addEventListener('click', () => {
  if (browseOpen) {
    closeBrowse();
  } else {
    pendingBrowseOpen = true;
    ipcRenderer.send('fetch-tasks');
  }
});

// ── Input handlers ──
input.addEventListener('input', () => {
  input.classList.toggle('has-text', input.value.length > 0);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submit();
  else if (e.key === 'Escape') dismiss();
});

function dismiss() {
  if (browseOpen) {
    closeBrowse();
    return;
  }
  pill.classList.remove('drop');
  void pill.offsetHeight;
  pill.classList.add('collapse');
  setTimeout(() => ipcRenderer.send('hide-window'), 230);
}

// ── Confetti ──
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number; color: string;
  life: number; maxLife: number;
  rotation: number; rotationSpeed: number;
}

const COLORS = ['#dc2626','#ef4444','#f87171','#fca5a5','#b91c1c','#ff6b8a','#fff1f2'];
let particles: Particle[] = [];
let animFrame: number | null = null;

function spawnConfetti() {
  confettiCanvas.width  = window.innerWidth;
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
      p.x += p.vx; p.y += p.vy; p.vy += 0.15;
      p.rotation += p.rotationSpeed; p.life++;
      ctx.save();
      ctx.globalAlpha = 1 - p.life / p.maxLife;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    if (particles.length > 0) animFrame = requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  }

  if (animFrame) cancelAnimationFrame(animFrame);
  draw();
}

// ── Submit ──
function submit() {
  const task = input.value.trim();
  if (!task) return;

  spawnConfetti();
  ipcRenderer.send('submit-task', task);
  input.value = '';
  input.classList.remove('has-text');

  // collapse browse first if open, then collapse pill
  if (browseOpen) {
    browseOpen = false;
    browseBtn.classList.remove('active');
  }

  pill.classList.remove('drop');
  void pill.offsetHeight;
  pill.classList.add('collapse');

  setTimeout(() => ipcRenderer.send('contract-to-notch'), 110);
}

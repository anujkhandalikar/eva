"use strict";
const { ipcRenderer } = require('electron');
const input = document.getElementById('taskInput');
const sentPill = document.getElementById('sentPill');
const confettiCanvas = document.getElementById('confetti');
const ctx = confettiCanvas.getContext('2d');
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
function rotatePlaceholder() {
    placeholderIndex = (placeholderIndex + 1) % placeholders.length;
    input.placeholder = placeholders[placeholderIndex];
}
// Rotate placeholder every time window gains focus
window.addEventListener('focus', () => {
    rotatePlaceholder();
    input.focus();
    input.value = '';
    input.classList.remove('has-text');
    document.body.classList.remove('sending');
    sentPill.className = 'sent-pill';
});
// Grow text as user types
input.addEventListener('input', () => {
    if (input.value.length > 0) {
        input.classList.add('has-text');
    }
    else {
        input.classList.remove('has-text');
    }
});
const COLORS = ['#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#be123c', '#ff6b8a', '#fff1f2'];
let particles = [];
let animFrame = null;
function spawnConfetti() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    const w = confettiCanvas.width;
    const h = confettiCanvas.height;
    particles = Array.from({ length: 36 }, () => ({
        x: w / 2 + (Math.random() - 0.5) * 60,
        y: h / 2 + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 6,
        vy: -(Math.random() * 4 + 2),
        size: Math.random() * 5 + 3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 0,
        maxLife: Math.random() * 30 + 40,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
    }));
    function draw() {
        ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        particles = particles.filter(p => p.life < p.maxLife);
        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.18;
            p.rotation += p.rotationSpeed;
            p.life++;
            const alpha = 1 - p.life / p.maxLife;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.55);
            ctx.restore();
        }
        if (particles.length > 0) {
            animFrame = requestAnimationFrame(draw);
        }
        else {
            ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
        }
    }
    if (animFrame)
        cancelAnimationFrame(animFrame);
    draw();
}
// --- Submit flow ---
function submit() {
    const task = input.value.trim();
    if (!task)
        return;
    // 1. visual: sending state + pulse border
    document.body.classList.add('sending');
    input.style.opacity = '0';
    // 2. confetti
    spawnConfetti();
    // 3. sent pill appears
    sentPill.className = 'sent-pill visible';
    // 4. send to main process
    ipcRenderer.send('submit-task', task);
    input.value = '';
    input.classList.remove('has-text');
    // 5. fade pill out, then hide window
    setTimeout(() => {
        sentPill.className = 'sent-pill fading';
        setTimeout(() => {
            input.style.opacity = '1';
            document.body.classList.remove('sending');
            sentPill.className = 'sent-pill';
            ipcRenderer.send('hide-window');
        }, 400);
    }, 800);
}
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        submit();
    }
    else if (e.key === 'Escape') {
        ipcRenderer.send('hide-window');
        input.value = '';
        input.classList.remove('has-text');
    }
});

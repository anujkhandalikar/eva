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
const pill = document.querySelector('.pill');
ipcRenderer.on('did-show', () => {
    placeholderIndex = (placeholderIndex + 1) % placeholders.length;
    input.placeholder = placeholders[placeholderIndex];
    input.value = '';
    input.style.opacity = '1';
    input.classList.remove('has-text');
    sentPill.className = 'sent-pill';
    // reset then re-trigger drop animation
    pill.classList.remove('drop');
    void pill.offsetHeight; // force reflow
    pill.classList.add('drop');
    setTimeout(() => input.focus(), 60);
});
ipcRenderer.on('did-hide', () => {
    input.value = '';
    input.classList.remove('has-text');
});
input.addEventListener('input', () => {
    input.classList.toggle('has-text', input.value.length > 0);
});
const COLORS = ['#e11d48', '#f43f5e', '#fb7185', '#fda4af', '#be123c', '#ff6b8a', '#fff1f2'];
let particles = [];
let animFrame = null;
function spawnConfetti() {
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    const w = confettiCanvas.width;
    const h = confettiCanvas.height;
    particles = Array.from({ length: 28 }, () => ({
        x: w / 2 + (Math.random() - 0.5) * 80,
        y: h / 2 + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 5,
        vy: -(Math.random() * 3 + 1),
        size: Math.random() * 4 + 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        life: 0,
        maxLife: Math.random() * 25 + 30,
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
// ── Submit ──
function submit() {
    const task = input.value.trim();
    if (!task)
        return;
    input.style.opacity = '0';
    spawnConfetti();
    sentPill.className = 'sent-pill visible';
    ipcRenderer.send('submit-task', task);
    input.value = '';
    input.classList.remove('has-text');
    setTimeout(() => {
        sentPill.className = 'sent-pill fading';
        setTimeout(() => ipcRenderer.send('hide-window'), 260);
    }, 750);
}
input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter')
        submit();
    else if (e.key === 'Escape')
        ipcRenderer.send('hide-window');
});

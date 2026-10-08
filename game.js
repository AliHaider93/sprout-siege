/* Sprout Siege — plant shooting plants against the shambling horde. MIT licence. */
(() => {
'use strict';

// ---------- constants & balance ----------
const W = 400, H = 720;
const COLS = 5, ROWS = 8, CW = 80, CH = 58;
const GRID_TOP = 120, GRID_BOT = GRID_TOP + ROWS * CH; // 584
const HOUSE_Y = GRID_BOT;
const SPAWN_Y = 62;
const SUN_VALUE = 25;
const SAVE_KEY = 'sproutsiege.v1';
const SITE_URL = (location.origin + location.pathname).replace(/index\.html$/, '');
const colX = c => c * CW + CW / 2;
const rowY = r => GRID_TOP + r * CH + CH / 2;
const colOf = x => clamp(Math.floor(x / CW), 0, COLS - 1);
const rowOf = y => Math.floor((y - GRID_TOP) / CH);

const PLANTS = {
  sunbloom:    { name: 'Sunbloom',    cost: 50,  cd: 6,  hp: 120,  unlock: 1, desc: 'Makes 25 sun every 10s. Tap the sun to collect it.' },
  seedshooter: { name: 'Seedshooter', cost: 100, cd: 6,  hp: 120,  unlock: 1, desc: 'Shoots a seed up its column every 1.4s.', shot: { dmg: 20, rate: 1.4 } },
  nutwall:     { name: 'Nutwall',     cost: 50,  cd: 18, hp: 1800, unlock: 2, desc: 'A tough wall zombies must chew through.' },
  blastberry:  { name: 'Blastberry',  cost: 150, cd: 28, hp: 100,  unlock: 3, desc: 'Explodes after a moment, wiping the 3×3 area around it.' },
  thornpatch:  { name: 'Thornpatch',  cost: 100, cd: 14, hp: 500,  unlock: 4, desc: 'Ground spikes. Zombies walk over it and bleed. Cannot be eaten.', ground: true },
  icebloom:    { name: 'Icebloom',    cost: 175, cd: 8,  hp: 120,  unlock: 5, desc: 'Frozen seeds slow zombies to half speed.', shot: { dmg: 20, rate: 1.4, slow: 4 } },
  twinshooter: { name: 'Twinshooter', cost: 200, cd: 8,  hp: 120,  unlock: 6, desc: 'Two seeds per shot.', shot: { dmg: 20, rate: 1.4, count: 2 } },
  twinbloom:   { name: 'Twinbloom',   cost: 125, cd: 8,  hp: 120,  unlock: 7, desc: 'Two flowers: makes 50 sun every 8s.' },
  lobber:      { name: 'Lobber',      cost: 175, cd: 8,  hp: 120,  unlock: 8, desc: 'Lobs melons over your front line. Splash damage on impact.', lob: { dmg: 45, rate: 2.4, splash: 46 } },
  gatling:     { name: 'Gatling',     cost: 250, cd: 10, hp: 120,  unlock: 9, desc: 'Four seeds per burst. Shreds anything in its column.', shot: { dmg: 20, rate: 1.4, count: 4 } },
};
const ZOMBIES = {
  basic:  { name: 'Shambler', hp: 100,  speed: 9,  dmg: 35,   r: 13 },
  worker: { name: 'Roadworker', hp: 260,  speed: 9,  dmg: 35,   r: 13 },
  runner: { name: 'Sprinter', hp: 80,   speed: 22, dmg: 35,   r: 11 },
  riot:   { name: 'Riot Zombie', hp: 650, speed: 8, dmg: 35,   r: 13 },
  giant:  { name: 'Hulk',     hp: 1600, speed: 6,  dmg: 0,    r: 19, smash: true },
};

// ---------- save ----------
function loadSave() {
  const d = { level: 1, best: 1, wins: 0, kills: 0, sound: true, autoSun: true };
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) Object.assign(d, s); } catch (e) { /* no storage */ }
  return d;
}
const save = loadSave();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

// ---------- helpers ----------
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const TAU = 6.2832;

// ---------- audio (tiny) ----------
let AC = null;
function beep(freq, dur, type, vol) {
  if (!save.sound) return;
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type || 'square'; o.frequency.value = freq;
    g.gain.value = vol || 0.04;
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
    o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + dur);
  } catch (e) { /* no audio */ }
}

// ---------- level generation ----------
function makeLevel(n) {
  const rng = mulberry32(n * 31337 + 7);
  const pick = arr => arr[Math.floor(rng() * arr.length)];
  const pool = ['basic', 'basic', 'basic'];
  if (n >= 2) pool.push('worker', 'worker');
  if (n >= 3) pool.push('runner');
  if (n >= 4) pool.push('riot');
  if (n >= 6) pool.push('giant');
  if (n >= 8) pool.push('giant', 'riot', 'runner');
  const total = 8 + n * 4;
  const sched = [];
  let t = 14;
  const gap = Math.max(2.0, 6 - n * 0.3);
  const main = Math.floor(total * 0.7), finalN = total - main;
  const midAt = Math.floor(main * 0.5);
  for (let i = 0; i < main; i++) {
    sched.push({ t, type: i < 3 ? 'basic' : pick(pool), col: Math.floor(rng() * COLS) });
    t += gap * (0.6 + rng() * 0.8);
    if (i === midAt) {
      const burst = 2 + Math.ceil(n * 0.8);
      for (let k = 0; k < burst; k++) sched.push({ t: t + 1 + k * 0.4, type: pick(pool), col: Math.floor(rng() * COLS), flag: k === 0 ? 'A huge wave approaches!' : null });
      t += 8;
    }
  }
  t += 5;
  for (let k = 0; k < finalN; k++) sched.push({ t: t + k * 0.45, type: pick(pool), col: Math.floor(rng() * COLS), flag: k === 0 ? 'FINAL WAVE!' : null });
  sched.sort((a, b) => a.t - b.t);
  return { n, sched, total: sched.length, startSun: 100 + Math.min(200, (n - 1) * 25), sunEvery: Math.max(3.5, 6.5 - n * 0.25),
    unlocked: Object.keys(PLANTS).filter(k => PLANTS[k].unlock <= n) };
}

// ---------- game state ----------
let L = null;
const G = {
  state: 'menu', t: 0, grid: Array.from({ length: ROWS }, () => new Array(COLS).fill(null)), zombies: [], shots: [], lobs: [], suns: [], parts: [], floats: [], toasts: [],
  sun: 0, spawned: 0, kills: 0, sunT: 0, cd: {}, selected: null, gnomes: [], gnomeRun: [], shake: 0, sunCollected: 0, planted: 0, lost: false,
};

function startLevel(n) {
  L = makeLevel(n);
  G.state = 'play'; G.t = 0; G.zombies = []; G.shots = []; G.lobs = []; G.suns = []; G.parts = []; G.floats = []; G.toasts = [];
  G.grid = []; for (let r = 0; r < ROWS; r++) { G.grid.push(new Array(COLS).fill(null)); }
  G.sun = L.startSun; G.spawned = 0; G.kills = 0; G.sunT = 4; G.cd = {}; G.selected = null; G.shake = 0; G.sunCollected = 0; G.planted = 0; G.lost = false;
  for (const k in PLANTS) G.cd[k] = 0;
  G.gnomes = new Array(COLS).fill(true); G.gnomeRun = new Array(COLS).fill(null);
  buildSeedBar();
  toast('Level ' + n + ' — plant before they arrive!', 2.6);
  showScreen(null);
}

function plant(type, r, c) {
  const P = PLANTS[type];
  if (G.grid[r][c] || G.sun < P.cost || G.cd[type] > 0) return false;
  G.sun -= P.cost; G.cd[type] = P.cd; G.planted++;
  G.grid[r][c] = { type, r, c, x: colX(c), y: rowY(r), hp: P.hp, maxHp: P.hp, timer: type === 'sunbloom' || type === 'twinbloom' ? 5 : type === 'blastberry' ? 1.2 : Math.random() * 0.5, ph: Math.random() * TAU, hit: 0 };
  puff(colX(c), rowY(r), '#a3e635', 8);
  beep(420, 0.08, 'triangle', 0.04);
  return true;
}
function dig(r, c) {
  const p = G.grid[r][c];
  if (!p) return false;
  G.grid[r][c] = null;
  for (const z of G.zombies) if (z.eating === p) z.eating = null;
  puff(p.x, p.y, '#92400e', 8); beep(200, 0.1, 'square', 0.04);
  return true;
}

function spawnZombie(type, col) {
  const Z = ZOMBIES[type];
  G.zombies.push({ type, col, x: colX(col) + (Math.random() - 0.5) * 16, y: SPAWN_Y - Math.random() * 20, hp: Z.hp, maxHp: Z.hp, speed: Z.speed, slow: 0, eating: null, smashT: 0, ph: Math.random() * TAU, hit: 0, dead: false, r: Z.r });
  G.spawned++;
}

function addSun(x, y, fromSky) {
  G.suns.push({ x, y: fromSky ? -20 : y - 10, tx: x, ty: y, falling: fromSky, life: 9, ph: Math.random() * TAU, vy: 0 });
}
function collectSun(s) {
  s.dead = true; G.sun += SUN_VALUE; G.sunCollected += SUN_VALUE;
  G.floats.push({ x: s.x, y: s.y, text: '+' + SUN_VALUE, life: 0.9, color: '#fde047' });
  beep(880, 0.08, 'triangle', 0.04);
}

function explodeAt(r, c) {
  const p = G.grid[r][c];
  G.grid[r][c] = null;
  for (const z of G.zombies) {
    if (z.dead) continue;
    const zr = rowOf(z.y);
    if (Math.abs(z.col - c) <= 1 && Math.abs(zr - r) <= 1) { z.hp -= 1800; z.hit = 0.2; if (z.hp <= 0) killZombie(z); }
  }
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * TAU, v = 60 + Math.random() * 220;
    G.parts.push({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, r: 2 + Math.random() * 4, color: ['#ef4444', '#fb923c', '#fde047'][i % 3] });
  }
  G.parts.push({ x: p.x, y: p.y, ring: true, life: 0.45, R: CW * 1.5 });
  G.shake = 1.2; beep(80, 0.5, 'sawtooth', 0.09);
}

function killZombie(z) {
  if (z.dead) return;
  z.dead = true; G.kills++;
  puff(z.x, z.y, '#86efac', 6);
  G.parts.push({ x: z.x, y: z.y, head: true, vx: (Math.random() - 0.5) * 80, vy: -120, life: 0.8, r: z.r * 0.55 });
  beep(140 + Math.random() * 40, 0.12, 'square', 0.035);
}

// ---------- simulation ----------
function update(dt) {
  G.t += dt;
  G.shake = Math.max(0, G.shake - dt * 3);
  for (const k in G.cd) G.cd[k] = Math.max(0, G.cd[k] - dt);

  // schedule
  while (G.spawned < L.sched.length && L.sched[G.spawned].t <= G.t) {
    const e = L.sched[G.spawned];
    if (e.flag) { toast(e.flag, 2.2); beep(110, 0.5, 'sawtooth', 0.07); }
    spawnZombie(e.type, e.col);
  }
  // sky sun
  G.sunT -= dt;
  if (G.sunT <= 0) { G.sunT = L.sunEvery; addSun(40 + Math.random() * (W - 80), GRID_TOP + 30 + Math.random() * (GRID_BOT - GRID_TOP - 60), true); }
  for (const s of G.suns) {
    s.ph += dt;
    if (s.falling) { s.y += 55 * dt; if (s.y >= s.ty) { s.y = s.ty; s.falling = false; } }
    else if (s.fly) {
      const dx = 28 - s.x, dy = 25 - s.y, d = Math.hypot(dx, dy) || 1, sp = 700 * dt;
      if (d < sp + 4) collectSun(s); else { s.x += dx / d * sp; s.y += dy / d * sp; }
    }
    else { s.life -= dt; if (save.autoSun && s.life < 8.3) s.fly = true; if (s.life <= 0) s.dead = true; }
  }

  // plants
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const p = G.grid[r][c];
    if (!p) continue;
    const P = PLANTS[p.type];
    if (p.hit > 0) p.hit -= dt;
    if (p.type === 'sunbloom' || p.type === 'twinbloom') {
      p.timer -= dt;
      if (p.timer <= 0) { p.timer = 8; addSun(p.x + (Math.random() - 0.5) * 30, p.y + 10, false); if (p.type === 'twinbloom') addSun(p.x + 18, p.y - 6, false); }
    } else if (P.lob) {
      p.timer -= dt;
      if (p.timer <= 0) {
        let tgt = null;
        for (const z of G.zombies) if (!z.dead && z.col === c && z.y < p.y - 10 && z.y > 30 && (!tgt || z.y > tgt.y)) tgt = z;
        if (tgt) { p.timer = P.lob.rate; G.lobs.push({ x: p.x, y: p.y - 10, sx: p.x, sy: p.y - 10, tx: tgt.x, ty: tgt.y + tgt.speed * 0.8, t: 0, dur: 0.8, dmg: P.lob.dmg, splash: P.lob.splash, dead: false }); beep(500, 0.08, 'triangle', 0.03); }
        else p.timer = 0.1;
      }
    } else if (p.type === 'blastberry') {
      p.timer -= dt;
      if (p.timer <= 0) explodeAt(r, c);
    } else if (P.shot) {
      p.timer -= dt;
      if (p.timer <= 0) {
        let tgt = false;
        for (const z of G.zombies) if (!z.dead && z.col === c && z.y < p.y - 4 && z.y > 20) { tgt = true; break; }
        if (tgt) {
          p.timer = P.shot.rate;
          const n = P.shot.count || 1;
          for (let i = 0; i < n; i++) G.shots.push({ x: p.x + 6, y: p.y - 14 - i * 14, col: c, dmg: P.shot.dmg, slow: P.shot.slow || 0, ice: !!P.shot.slow, dead: false });
          beep(P.shot.slow ? 1200 : 700, 0.04, 'triangle', 0.02);
        } else p.timer = 0.1;
      }
    } else if (p.type === 'thornpatch') {
      for (const z of G.zombies) {
        if (z.dead || z.col !== c) continue;
        if (Math.abs(z.y - p.y) < CH / 2 + 4) { z.hp -= 25 * dt; z.hit = 0.05; if (z.hp <= 0) killZombie(z); }
      }
    }
  }

  // shots
  for (const s of G.shots) {
    if (s.dead) continue;
    s.y -= 330 * dt;
    if (s.y < 20) { s.dead = true; continue; }
    for (const z of G.zombies) {
      if (z.dead || z.col !== s.col) continue;
      if (s.y <= z.y + z.r && s.y >= z.y - z.r - 6) {
        s.dead = true; z.hp -= s.dmg; z.hit = 0.1;
        if (s.slow) z.slow = s.slow;
        puff(s.x, s.y, s.ice ? '#bae6fd' : '#bef264', 2);
        if (z.hp <= 0) killZombie(z);
        break;
      }
    }
  }

  // lobbed melons: arc to the target spot, splash on landing
  for (const l of G.lobs) {
    if (l.dead) continue;
    l.t += dt;
    const k = Math.min(1, l.t / l.dur);
    l.x = l.sx + (l.tx - l.sx) * k; l.y = l.sy + (l.ty - l.sy) * k - Math.sin(k * Math.PI) * 90;
    if (k >= 1) {
      l.dead = true; puff(l.tx, l.ty, '#86efac', 10); G.parts.push({ x: l.tx, y: l.ty, ring: true, life: 0.25, R: l.splash });
      for (const z of G.zombies) { if (z.dead) continue; if ((z.x - l.tx) ** 2 + (z.y - l.ty) ** 2 < l.splash * l.splash) { z.hp -= l.dmg; z.hit = 0.15; if (z.hp <= 0) killZombie(z); } }
      beep(160, 0.12, 'square', 0.04);
    }
  }
  // zombies
  for (const z of G.zombies) {
    if (z.dead) continue;
    const Z = ZOMBIES[z.type];
    if (z.hit > 0) z.hit -= dt;
    if (z.slow > 0) z.slow -= dt;
    const sp = z.speed * (z.slow > 0 ? 0.5 : 1);
    if (z.eating) {
      const p = z.eating;
      if (G.grid[p.r][p.c] !== p || p.hp <= 0) { z.eating = null; }
      else if (Z.smash) {
        z.smashT -= dt;
        if (z.smashT <= 0) { G.grid[p.r][p.c] = null; puff(p.x, p.y, '#a3e635', 12); G.shake = 0.6; beep(90, 0.2, 'square', 0.06); z.eating = null; }
      } else {
        p.hp -= Z.dmg * dt; p.hit = 0.1;
        if (p.hp <= 0) { G.grid[p.r][p.c] = null; puff(p.x, p.y, '#a3e635', 10); z.eating = null; }
        if (Math.random() < dt * 3) beep(60 + Math.random() * 30, 0.05, 'square', 0.02);
      }
    }
    if (!z.eating) {
      z.y += sp * dt;
      const front = z.y + z.r * 0.6;
      const r = rowOf(front);
      if (r >= 0 && r < ROWS) {
        const p = G.grid[r][z.col];
        if (p && !PLANTS[p.type].ground && front >= rowY(r) - CH / 2 + 6) {
          z.eating = p; z.smashT = 0.9;
        }
      }
      if (z.y > HOUSE_Y + 6) {
        if (G.gnomes[z.col]) {
          G.gnomes[z.col] = false; G.gnomeRun[z.col] = { y: HOUSE_Y + 18 };
          toast('Gnome to the rescue!', 1.4); beep(500, 0.2, 'square', 0.06);
        } else if (!G.lost) { G.lost = true; }
      }
    }
  }
  // gnomes
  for (let c = 0; c < COLS; c++) {
    const g = G.gnomeRun[c];
    if (!g) continue;
    g.y -= 420 * dt;
    for (const z of G.zombies) if (!z.dead && z.col === c && z.y > g.y - 24) killZombie(z);
    if (g.y < 10) G.gnomeRun[c] = null;
  }

  G.zombies = G.zombies.filter(z => !z.dead);
  G.shots = G.shots.filter(s => !s.dead);
  G.lobs = G.lobs.filter(l => !l.dead);
  G.suns = G.suns.filter(s => !s.dead);
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const p = G.parts[i]; p.life -= dt;
    if (p.life <= 0) { G.parts.splice(i, 1); continue; }
    if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.94; p.vy = p.vy * 0.94 + (p.head ? 400 : 80) * dt; }
  }
  for (let i = G.floats.length - 1; i >= 0; i--) { const f = G.floats[i]; f.life -= dt; f.y -= 35 * dt; if (f.life <= 0) G.floats.splice(i, 1); }
  for (let i = G.toasts.length - 1; i >= 0; i--) { G.toasts[i].t -= dt; if (G.toasts[i].t <= 0) G.toasts.splice(i, 1); }

  if (G.lost) endLevel(false);
  else if (G.spawned >= L.sched.length && G.zombies.length === 0) endLevel(true);
}

function puff(x, y, color, n) {
  if (G.parts.length > 400) return;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = 20 + Math.random() * 70;
    G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.25 + Math.random() * 0.25, r: 1.5 + Math.random() * 2.5, color });
  }
}
function toast(msg, t) { G.toasts.push({ msg, t: t || 1.5, max: t || 1.5 }); }

function endLevel(win) {
  G.state = win ? 'win' : 'lose';
  save.kills += G.kills;
  if (win) { save.wins++; save.level = L.n + 1; save.best = Math.max(save.best, L.n + 1); }
  persist();
  beep(win ? 660 : 110, 0.6, win ? 'triangle' : 'sawtooth', 0.07);
  if (win) setTimeout(() => beep(880, 0.6, 'triangle', 0.07), 150);
  showEnd(win);
}

// ---------- rendering ----------
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('wrap');
let scale = 1;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const vw = window.innerWidth, vh = window.innerHeight;
  scale = Math.min(vw / W, vh / H);
  const cw = Math.round(W * scale), ch = Math.round(H * scale);
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  wrap.style.width = cw + 'px'; wrap.style.height = ch + 'px';
  wrap.style.setProperty('--u', scale + 'px');
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, 0, 0);
}
window.addEventListener('resize', resize);
resize();

function roundRect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function leaf(c, x, y, a, len, w, color) {
  c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = color;
  c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.5, -w, len, 0); c.quadraticCurveTo(len * 0.5, w, 0, 0); c.fill(); c.restore();
}
function stem(c, x, y, h) {
  c.strokeStyle = '#15803d'; c.lineWidth = 4; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y + 20); c.quadraticCurveTo(x + 3, y + 8, x, y - h); c.stroke();
  leaf(c, x, y + 12, -2.6, 14, 5, '#22c55e'); leaf(c, x, y + 14, -0.5, 14, 5, '#16a34a');
}
function face(c, x, y, s, angry) {
  c.fillStyle = '#111827';
  c.beginPath(); c.arc(x - 4 * s, y, 1.8 * s, 0, TAU); c.arc(x + 4 * s, y, 1.8 * s, 0, TAU); c.fill();
  c.strokeStyle = '#111827'; c.lineWidth = 1.5 * s; c.beginPath();
  if (angry) { c.moveTo(x - 7 * s, y - 4 * s); c.lineTo(x - 2 * s, y - 2 * s); c.moveTo(x + 7 * s, y - 4 * s); c.lineTo(x + 2 * s, y - 2 * s); }
  else { c.arc(x, y + 3 * s, 4 * s, 0.2, Math.PI - 0.2); }
  c.stroke();
}

// Each plant is drawn centred on (x, y) at scale s (1 = one grid cell).
function drawPlant(c, type, x, y, s, t, ph, hit) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const bob = Math.sin(t * 3 + ph) * 1.5;
  if (hit > 0) { c.globalAlpha = 0.6; }
  switch (type) {
    case 'sunbloom': {
      stem(c, 0, 8, 10);
      c.save(); c.translate(0, -8 + bob); c.rotate(t * 0.4);
      c.fillStyle = '#facc15';
      for (let i = 0; i < 10; i++) { c.rotate(TAU / 10); c.beginPath(); c.ellipse(0, -14, 5, 9, 0, 0, TAU); c.fill(); }
      c.restore();
      c.fillStyle = '#f59e0b'; c.beginPath(); c.arc(0, -8 + bob, 10, 0, TAU); c.fill();
      face(c, 0, -8 + bob, 1, false);
      break;
    }
    case 'twinbloom': {
      stem(c, -8, 8, 6); stem(c, 9, 10, 2);
      for (const [hx, hy, hr] of [[-8, -10, 0.8], [9, -2, 0.7]]) {
        c.save(); c.translate(hx, hy + bob); c.rotate(t * 0.5 + hx);
        c.fillStyle = '#facc15';
        for (let i = 0; i < 9; i++) { c.rotate(TAU / 9); c.beginPath(); c.ellipse(0, -11 * hr, 4 * hr, 7 * hr, 0, 0, TAU); c.fill(); }
        c.restore();
        c.fillStyle = '#f59e0b'; c.beginPath(); c.arc(hx, hy + bob, 8 * hr, 0, TAU); c.fill();
        face(c, hx, hy + bob, 0.8 * hr, false);
      }
      break;
    }
    case 'lobber': {
      stem(c, 0, 8, 6);
      c.fillStyle = '#15803d'; c.beginPath(); c.ellipse(0, 4 + bob, 20, 14, 0, 0, TAU); c.fill();
      c.fillStyle = '#4ade80'; c.beginPath(); c.ellipse(-2, 1 + bob, 14, 9, 0, 0, TAU); c.fill();
      c.strokeStyle = '#166534'; c.lineWidth = 2; for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(i * 8 - 4, -6 + bob); c.quadraticCurveTo(i * 8, 4 + bob, i * 8 - 4, 14 + bob); c.stroke(); }
      c.fillStyle = '#78350f'; c.fillRect(-3, -22 + bob, 6, 16);
      c.fillStyle = '#bef264'; c.beginPath(); c.arc(0, -24 + bob, 7, 0, TAU); c.fill();
      face(c, -2, 2 + bob, 0.9, true);
      break;
    }
    case 'seedshooter': case 'icebloom': case 'twinshooter': case 'gatling': {
      const col = type === 'icebloom' ? '#38bdf8' : type === 'gatling' ? '#22c55e' : '#4ade80', dark = type === 'icebloom' ? '#0369a1' : type === 'gatling' ? '#064e3b' : '#15803d';
      stem(c, 0, 8, 10);
      if (type === 'gatling') { c.fillStyle = '#334155'; roundRect(c, -14, -34 + bob, 28, 12, 4); c.fill(); c.fillStyle = '#0f172a'; for (const bx of [-9, -3, 3, 9]) { c.beginPath(); c.ellipse(bx, -28 + bob, 2.4, 4, 0, 0, TAU); c.fill(); } c.fillStyle = '#475569'; roundRect(c, -6, -12 + bob, 12, 8, 2); c.fill(); }
      const heads = type === 'twinshooter' ? [[-7, -4], [7, -12]] : [[0, -8]];
      for (const [hx, hy] of heads) {
        c.fillStyle = col; c.beginPath(); c.arc(hx, hy + bob, 13, 0, TAU); c.fill();
        c.fillStyle = dark; roundRect(c, hx - 8, hy + bob - 24, 16, 14, 6); c.fill();
        c.fillStyle = '#111827'; c.beginPath(); c.ellipse(hx, hy + bob - 19, 5, 3, 0, 0, TAU); c.fill();
        c.fillStyle = dark; leaf(c, hx + 8, hy + bob - 6, -1.2, 10, 4, dark);
        face(c, hx, hy + bob + 2, 0.9, false);
      }
      if (type === 'icebloom') { c.fillStyle = 'rgba(224,242,254,0.8)'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-10 + i * 7, -20 + bob + (i % 2) * 4, 2, 0, TAU); c.fill(); } }
      break;
    }
    case 'nutwall': {
      c.fillStyle = '#78350f'; c.beginPath(); c.ellipse(0, 0 + bob, 20, 24, 0, 0, TAU); c.fill();
      c.fillStyle = '#b45309'; c.beginPath(); c.ellipse(-3, -4 + bob, 14, 17, 0, 0, TAU); c.fill();
      c.fillStyle = '#92400e'; c.beginPath(); c.ellipse(0, 12 + bob, 10, 5, 0, 0, TAU); c.fill();
      face(c, 0, -4 + bob, 1.1, false);
      break;
    }
    case 'blastberry': {
      const pulse = 1 + Math.sin(t * 25) * 0.08;
      c.fillStyle = '#7f1d1d'; c.beginPath(); c.arc(-8, 4, 12 * pulse, 0, TAU); c.arc(9, 6, 11 * pulse, 0, TAU); c.fill();
      c.fillStyle = '#dc2626'; c.beginPath(); c.arc(-8, 2, 10 * pulse, 0, TAU); c.arc(9, 4, 9 * pulse, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(-11, -2, 3, 0, TAU); c.arc(6, 1, 2.5, 0, TAU); c.fill();
      c.strokeStyle = '#15803d'; c.lineWidth = 3; c.beginPath(); c.moveTo(-8, -8); c.quadraticCurveTo(0, -22, 9, -6); c.stroke();
      c.fillStyle = '#fde047'; c.beginPath(); c.arc(0, -16, 3 + Math.sin(t * 40) * 1.5, 0, TAU); c.fill();
      face(c, -8, 3, 0.8, true); face(c, 9, 5, 0.7, true);
      break;
    }
    case 'thornpatch': {
      c.fillStyle = '#365314'; roundRect(c, -32, -14, 64, 30, 8); c.fill();
      c.fillStyle = '#a3a3a3';
      for (let i = 0; i < 6; i++) { const sx = -26 + i * 10.5, sy = (i % 2 ? 4 : -2); c.beginPath(); c.moveTo(sx - 4, sy + 8); c.lineTo(sx, sy - 10); c.lineTo(sx + 4, sy + 8); c.fill(); }
      c.fillStyle = '#e5e5e5';
      for (let i = 0; i < 6; i++) { const sx = -26 + i * 10.5, sy = (i % 2 ? 4 : -2); c.beginPath(); c.moveTo(sx - 1.5, sy + 2); c.lineTo(sx, sy - 10); c.lineTo(sx + 1.5, sy + 2); c.fill(); }
      break;
    }
  }
  c.restore();
}

function drawZombie(c, z, t) {
  const Z = ZOMBIES[z.type], s = z.type === 'giant' ? 1.5 : z.type === 'runner' ? 0.85 : 1;
  const x = z.x, y = z.y;
  const step = z.eating ? Math.sin(t * 12 + z.ph) * 2 : Math.sin(t * 5 + z.ph) * 3;
  c.save(); c.translate(x, y); c.scale(s, s);
  const bodyCol = z.type === 'runner' ? '#525252' : z.type === 'giant' ? '#4b5563' : '#6b7280';
  // legs
  c.fillStyle = '#374151'; c.fillRect(-7, 6 + step, 5, 11); c.fillRect(2, 6 - step, 5, 11);
  // arms stretched forward (down the lawn)
  c.fillStyle = '#86efac'; c.fillRect(-13, 2, 5, 14 + step * 0.5); c.fillRect(8, 2, 5, 14 - step * 0.5);
  // body
  c.fillStyle = z.hit > 0 ? '#fff' : bodyCol; roundRect(c, -11, -8, 22, 18, 5); c.fill();
  c.fillStyle = '#374151'; c.fillRect(-11, 6, 22, 4);
  if (z.type === 'giant') { c.fillStyle = '#92400e'; c.fillRect(14, -30, 4, 40); c.fillStyle = '#78716c'; roundRect(c, 10, -34, 12, 10, 3); c.fill(); }
  // head
  c.fillStyle = z.hit > 0 ? '#fff' : '#a3e635'; c.beginPath(); c.arc(0, -16, 10, 0, TAU); c.fill();
  c.fillStyle = '#365314'; c.beginPath(); c.arc(-3.5, -16, 2.2, 0, TAU); c.arc(4, -15, 1.6, 0, TAU); c.fill();
  c.fillStyle = '#ef4444'; c.beginPath(); c.arc(-3.5, -16, 1, 0, TAU); c.fill();
  c.strokeStyle = '#365314'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-4, -9); c.lineTo(5, -10); c.stroke();
  c.fillStyle = '#f5f5f4'; c.fillRect(-2, -10, 2, 2); c.fillRect(2, -10.5, 2, 2);
  if (z.type === 'worker') {
    // reflective vest over the body, yellow hard hat with a brim
    c.fillStyle = '#f97316'; roundRect(c, -9, -7, 18, 15, 3); c.fill(); c.fillStyle = '#e5e7eb'; c.fillRect(-9, -2, 18, 3); c.fillStyle = '#6b7280'; c.fillRect(-2, -7, 4, 15);
    c.fillStyle = '#facc15'; c.beginPath(); c.arc(0, -19, 11, Math.PI, 0); c.fill(); c.fillRect(-13, -20, 26, 4);
    c.fillStyle = '#fef08a'; c.fillRect(-2, -29, 4, 9); c.fillStyle = '#ca8a04'; c.fillRect(-13, -17, 26, 2);
  }
  if (z.type === 'riot') {
    // riot helmet with a visor, and a shield held out in front
    c.fillStyle = '#1f2937'; c.beginPath(); c.arc(0, -17, 12, Math.PI, 0); c.fill(); c.fillRect(-12, -17, 24, 6);
    c.fillStyle = 'rgba(125,211,252,0.55)'; roundRect(c, -9, -17, 18, 9, 3); c.fill();
    c.fillStyle = '#374151'; c.fillRect(-12, -11, 24, 2);
    c.fillStyle = '#111827'; roundRect(c, -22, -10, 14, 28, 4); c.fill();
    c.fillStyle = 'rgba(148,163,184,0.45)'; roundRect(c, -19, -7, 8, 22, 3); c.fill();
    c.fillStyle = '#9ca3af'; c.fillRect(-16, 0, 3, 6);
  }
  if (z.type === 'runner') { c.fillStyle = '#ef4444'; c.fillRect(-10, -20, 20, 3); }
  if (z.slow > 0) { c.fillStyle = 'rgba(125,211,252,0.45)'; c.beginPath(); c.arc(0, -8, 18, 0, TAU); c.fill(); }
  c.restore();
  const w = 26 * s, f = clamp(z.hp / z.maxHp, 0, 1);
  if (f < 1) { c.fillStyle = 'rgba(0,0,0,0.4)'; c.fillRect(x - w / 2, y - 30 * s - 4, w, 3); c.fillStyle = f > 0.5 ? '#4ade80' : '#f87171'; c.fillRect(x - w / 2, y - 30 * s - 4, w * f, 3); }
}

function drawSun(c, s) {
  c.save(); c.translate(s.x, s.y); c.rotate(s.ph * 0.8);
  c.globalAlpha = !s.falling && s.life < 2 ? 0.4 + Math.sin(s.ph * 12) * 0.3 : 1;
  c.fillStyle = 'rgba(253,224,71,0.35)'; c.beginPath(); c.arc(0, 0, 20, 0, TAU); c.fill();
  c.fillStyle = '#facc15';
  for (let i = 0; i < 8; i++) { c.rotate(TAU / 8); c.beginPath(); c.moveTo(-4, -9); c.lineTo(0, -18); c.lineTo(4, -9); c.fill(); }
  c.fillStyle = '#fde047'; c.beginPath(); c.arc(0, 0, 10, 0, TAU); c.fill();
  c.fillStyle = '#fef9c3'; c.beginPath(); c.arc(-3, -3, 3.5, 0, TAU); c.fill();
  c.restore();
}

function draw() {
  ctx.save();
  if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake * 8, (Math.random() - 0.5) * G.shake * 8);

  // sky / graveyard band
  ctx.fillStyle = '#1e293b'; ctx.fillRect(-10, -10, W + 20, GRID_TOP + 10);
  ctx.fillStyle = '#334155';
  for (let i = 0; i < 7; i++) { const gx = 20 + i * 60, gh = 18 + (i % 3) * 6; roundRect(ctx, gx, GRID_TOP - 14 - gh, 22, gh + 14, 5); ctx.fill(); }
  ctx.fillStyle = '#475569'; ctx.fillRect(-10, GRID_TOP - 8, W + 20, 8);
  // lawn
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      ctx.fillStyle = (r + c) % 2 ? '#65a30d' : '#84cc16';
      ctx.fillRect(c * CW, GRID_TOP + r * CH, CW, CH);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let c = 1; c < COLS; c++) ctx.fillRect(c * CW - 1, GRID_TOP, 2, ROWS * CH);
  // house band
  ctx.fillStyle = '#a16207'; ctx.fillRect(-10, GRID_BOT, W + 20, 6);
  ctx.fillStyle = '#d6d3d1'; ctx.fillRect(-10, GRID_BOT + 6, W + 20, H - GRID_BOT);
  ctx.fillStyle = '#a8a29e'; for (let x = 0; x < W; x += 40) ctx.fillRect(x + ((Math.floor(x / 40) % 2) ? 0 : 20), GRID_BOT + 6, 20, 2);
  // gnomes
  for (let c = 0; c < COLS; c++) {
    const g = G.gnomeRun[c];
    const gx = colX(c), gy = g ? g.y : GRID_BOT + 22;
    if (!G.gnomes[c] && !g) continue;
    ctx.fillStyle = '#1d4ed8'; roundRect(ctx, gx - 7, gy - 4, 14, 14, 4); ctx.fill();
    ctx.fillStyle = '#fcd9b6'; ctx.beginPath(); ctx.arc(gx, gy - 8, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = '#f5f5f4'; ctx.beginPath(); ctx.arc(gx, gy - 4, 5, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.moveTo(gx - 7, gy - 11); ctx.lineTo(gx, gy - 28); ctx.lineTo(gx + 7, gy - 11); ctx.fill();
  }

  // selection highlight
  if (G.state === 'play' && G.hover && G.selected) {
    const { r, c } = G.hover;
    const ok = G.selected === 'shovel' ? !!G.grid[r][c] : !G.grid[r][c];
    ctx.fillStyle = ok ? 'rgba(255,255,255,0.28)' : 'rgba(239,68,68,0.3)';
    ctx.fillRect(c * CW, GRID_TOP + r * CH, CW, CH);
  }
  // plants
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const p = G.grid[r] && G.grid[r][c]; if (!p) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 20, 18, 6, 0, 0, TAU); ctx.fill();
    drawPlant(ctx, p.type, p.x, p.y, 1, G.t, p.ph, p.hit);
    if (p.hp < p.maxHp && p.type !== 'blastberry') {
      const f = p.hp / p.maxHp;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(p.x - 16, p.y + 24, 32, 3);
      ctx.fillStyle = f > 0.4 ? '#4ade80' : '#f87171'; ctx.fillRect(p.x - 16, p.y + 24, 32 * f, 3);
    }
  }
  // shots
  for (const s of G.shots) {
    ctx.fillStyle = s.ice ? '#7dd3fc' : '#65a30d'; ctx.beginPath(); ctx.ellipse(s.x, s.y, 4, 6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = s.ice ? '#e0f2fe' : '#bef264'; ctx.beginPath(); ctx.arc(s.x - 1, s.y - 2, 1.6, 0, TAU); ctx.fill();
  }
  for (const l of G.lobs) {
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(l.x, l.sy + (l.ty - l.sy) * Math.min(1, l.t / l.dur) + 6, 7, 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#15803d'; ctx.beginPath(); ctx.arc(l.x, l.y, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#86efac'; ctx.beginPath(); ctx.arc(l.x - 2, l.y - 2, 3.5, 0, TAU); ctx.fill();
  }
  // zombies (sorted by y so lower ones overlap)
  const zs = G.zombies.slice().sort((a, b) => a.y - b.y);
  for (const z of zs) drawZombie(ctx, z, G.t);
  // particles
  for (const p of G.parts) {
    if (p.ring) { ctx.strokeStyle = `rgba(253,224,71,${p.life / 0.45})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(p.x, p.y, p.R * (1 - p.life / 0.45), 0, TAU); ctx.stroke(); continue; }
    ctx.globalAlpha = clamp(p.life * 2.5, 0, 1);
    if (p.head) { ctx.fillStyle = '#a3e635'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); ctx.fillStyle = '#365314'; ctx.beginPath(); ctx.arc(p.x - 2, p.y - 1, 1.5, 0, TAU); ctx.arc(p.x + 2, p.y - 1, 1.5, 0, TAU); ctx.fill(); }
    else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // suns on top of everything
  for (const s of G.suns) drawSun(ctx, s);
  for (const f of G.floats) {
    ctx.globalAlpha = clamp(f.life, 0, 1); ctx.fillStyle = f.color; ctx.font = 'bold 18px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 4; ctx.fillText(f.text, f.x, f.y); ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // HUD
  if (L) {
    ctx.fillStyle = 'rgba(15,23,42,0.75)'; roundRect(ctx, 8, 8, 110, 34, 10); ctx.fill();
    drawSun(ctx, { x: 28, y: 25, ph: G.t * 0.3, falling: true, life: 9 });
    ctx.fillStyle = '#fde047'; ctx.font = 'bold 18px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(G.sun, 50, 26);
    ctx.fillStyle = 'rgba(15,23,42,0.75)'; roundRect(ctx, 128, 8, W - 136, 34, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui, sans-serif'; ctx.fillText('LVL ' + L.n, 140, 25);
    const bx = 196, bw = W - 8 - 12 - bx, prog = G.spawned / L.sched.length;
    ctx.fillStyle = '#1e293b'; roundRect(ctx, bx, 18, bw, 14, 7); ctx.fill();
    ctx.fillStyle = '#84cc16'; roundRect(ctx, bx, 18, Math.max(14, bw * prog), 14, 7); ctx.fill();
    ctx.fillStyle = '#ef4444';
    for (const f of [0.5, 1]) { const fx = bx + bw * f - 6; ctx.fillRect(fx, 12, 2, 24); ctx.beginPath(); ctx.moveTo(fx + 2, 12); ctx.lineTo(fx + 12, 16); ctx.lineTo(fx + 2, 20); ctx.fill(); }
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('WAVE PROGRESS', bx + bw / 2, 25);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  G.toasts.forEach((t, i) => {
    const a = clamp(t.t * 2, 0, 1) * clamp((t.max - t.t) * 4, 0, 1);
    ctx.globalAlpha = a; ctx.font = 'bold 20px system-ui, sans-serif';
    const tw = Math.max(240, ctx.measureText(t.msg).width + 30);
    ctx.fillStyle = 'rgba(15,23,42,0.7)'; roundRect(ctx, W / 2 - tw / 2, 330 + i * 40 - 18, tw, 36, 10); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(t.msg, W / 2, 330 + i * 40);
  });
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---------- seed bar (DOM) ----------
const seedbar = document.getElementById('seedbar');
const seedIcons = {};
function seedIcon(type) {
  if (seedIcons[type]) return seedIcons[type];
  const cv = document.createElement('canvas'); cv.width = cv.height = 96;
  const c = cv.getContext('2d');
  if (c && c.translate) { drawPlant(c, type, 48, 52, 1.5, 1, 0, 0); seedIcons[type] = cv.toDataURL ? cv.toDataURL() : ''; }
  else seedIcons[type] = '';
  return seedIcons[type];
}
function buildSeedBar() {
  if (!seedbar) return;
  let html = '<div id="seeds" class="' + (L.unlocked.length > 5 ? 'two' : 'one') + '">';
  for (const k of L.unlocked) {
    const P = PLANTS[k];
    html += `<button class="seed" data-seed="${k}" title="${P.name}: ${P.desc}"><img src="${seedIcon(k)}" alt=""><span class="cost">${P.cost}</span><span class="cdm"></span></button>`;
  }
  html += `</div><button class="seed shovel" data-seed="shovel" title="Dig up a plant"><span class="sv">⛏</span><span class="cost">DIG</span></button>`;
  seedbar.innerHTML = html;
}
seedbar && seedbar.addEventListener('pointerdown', e => {
  const b = e.target.closest('button'); if (!b || G.state !== 'play') return;
  e.preventDefault(); e.stopPropagation();
  G.selected = G.selected === b.dataset.seed ? null : b.dataset.seed;
  beep(520, 0.05, 'triangle', 0.03);
});
function updateSeedBar() {
  if (!seedbar) return;
  for (const b of seedbar.querySelectorAll('button')) {
    const k = b.dataset.seed;
    b.classList.toggle('sel', G.selected === k);
    if (k === 'shovel') continue;
    const P = PLANTS[k], cd = G.cd[k];
    b.classList.toggle('poor', G.sun < P.cost);
    b.classList.toggle('cooling', cd > 0);
    b.style.setProperty('--cd', (cd / P.cd * 100).toFixed(1) + '%');
  }
}

// ---------- input ----------
function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
function tap(x, y) {
  if (G.state !== 'play') return;
  // suns first: generous radius
  let best = null, bd = 30 * 30;
  for (const s of G.suns) { const d = (s.x - x) ** 2 + (s.y - y) ** 2; if (d < bd) { bd = d; best = s; } }
  if (best) { collectSun(best); return; }
  const r = rowOf(y), c = colOf(x);
  if (r < 0 || r >= ROWS) { G.selected = null; return; }
  if (!G.selected) return;
  if (G.selected === 'shovel') { if (dig(r, c)) G.selected = null; return; }
  if (plant(G.selected, r, c)) G.selected = null;
  else if (G.grid[r][c]) { G.floats.push({ x: colX(c), y: rowY(r), text: 'occupied', life: 0.8, color: '#fecaca' }); }
  else if (G.sun < PLANTS[G.selected].cost) { G.floats.push({ x: colX(c), y: rowY(r), text: 'need sun', life: 0.8, color: '#fecaca' }); beep(150, 0.1, 'square', 0.03); }
}
canvas.addEventListener('pointerdown', e => {
  if (!AC) beep(1, 0.01, 'sine', 0.0001);
  const p = pointerPos(e); tap(p.x, p.y);
});
canvas.addEventListener('pointermove', e => {
  const p = pointerPos(e); const r = rowOf(p.y);
  G.hover = r >= 0 && r < ROWS ? { r, c: colOf(p.x) } : null;
});
canvas.addEventListener('pointerleave', () => { G.hover = null; });
window.addEventListener('keydown', e => {
  if (G.state !== 'play' || !L) return;
  const n = parseInt(e.key, 10);
  const idx = e.key === '0' ? 9 : n - 1;
  if (!isNaN(idx) && idx >= 0 && idx < L.unlocked.length) G.selected = L.unlocked[idx];
  if (e.key === 'Escape') G.selected = null;
  if (e.key === 'x' || e.key === 'X') G.selected = 'shovel';
});

// ---------- screens ----------
const $ = id => document.getElementById(id);
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('hidden', s.id !== id));
  $('seedbar').classList.toggle('hidden', G.state !== 'play');
}
function showMenu() {
  G.state = 'menu';
  $('menu-level').textContent = 'PLAY  ·  LEVEL ' + save.level;
  $('menu-best').textContent = save.best > 1 ? 'Best: level ' + (save.best - 1) + ' survived  ·  ' + save.kills.toLocaleString() + ' zombies stopped' : 'Tap a seed, tap the lawn. Tap the sun to collect it.';
  $('btn-sound').textContent = save.sound ? '🔊 Sound on' : '🔇 Sound off';
  $('btn-autosun').textContent = save.autoSun ? '☀ Auto-collect sun: ON' : '☀ Auto-collect sun: OFF';
  let html = '';
  for (const k in PLANTS) { const P = PLANTS[k]; html += `<div class="item"><img src="${seedIcon(k)}" alt=""><div class="info"><b>${P.name} <em>${P.cost} sun · level ${P.unlock}</em></b><span>${P.desc}</span></div></div>`; }
  for (const k in ZOMBIES) { const Z = ZOMBIES[k]; html += `<div class="item z"><div class="info"><b>🧟 ${Z.name} <em>${Z.hp} hp</em></b><span>${k === 'giant' ? 'Smashes plants flat instead of eating them.' : k === 'runner' ? 'Fast, but flimsy.' : k === 'worker' ? 'Hard hat and vest. Takes a beating.' : k === 'riot' ? 'Helmet, visor and a riot shield. Very tough.' : 'Your everyday shambler.'}</span></div></div>`; }
  $('almanac').innerHTML = html;
  showScreen('menu');
}
function showEnd(win) {
  $('end-title').textContent = win ? 'GARDEN SAFE!' : 'BRAINS...';
  $('end-title').className = win ? 'win' : 'lose';
  $('end-sub').textContent = win ? 'Level ' + L.n + ' survived' : 'The zombies reached your house on level ' + L.n;
  $('end-stats').innerHTML =
    `<div><b>${G.kills}</b><span>zombies stopped</span></div>` +
    `<div><b>${G.planted}</b><span>plants planted</span></div>` +
    `<div><b>${G.sunCollected}</b><span>sun collected</span></div>`;
  $('btn-next').textContent = win ? 'NEXT LEVEL ▶' : 'RETRY ↻';
  const text = win
    ? `My garden survived level ${L.n} of Sprout Siege and stopped ${G.kills} zombies! 🌻🧟 Can you beat it?`
    : `The horde ate my garden on level ${L.n} of Sprout Siege after ${G.kills} zombies. 🌻🧟 Think you can hold the lawn?`;
  $('btn-share').href = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(SITE_URL) + '&hashtags=SproutSiege';
  showScreen('end');
}
$('btn-play').addEventListener('click', () => startLevel(save.level));
$('btn-howto').addEventListener('click', () => $('howto').classList.toggle('hidden'));
$('btn-almanac').addEventListener('click', () => $('almanac').classList.toggle('hidden'));
$('btn-sound').addEventListener('click', () => { save.sound = !save.sound; persist(); $('btn-sound').textContent = save.sound ? '🔊 Sound on' : '🔇 Sound off'; });
$('btn-autosun').addEventListener('click', () => { save.autoSun = !save.autoSun; persist(); $('btn-autosun').textContent = save.autoSun ? '☀ Auto-collect sun: ON' : '☀ Auto-collect sun: OFF'; });
$('btn-next').addEventListener('click', () => startLevel(save.level));
$('btn-end-menu').addEventListener('click', showMenu);
$('btn-reset').addEventListener('click', () => {
  if (!confirm('Reset all progress?')) return;
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  location.reload();
});

// ---------- main loop ----------
let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.05) dt = 0.05;
  if (G.state === 'play') { update(dt); updateSeedBar(); }
  draw();
  requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange', () => { last = performance.now(); });

showMenu();
requestAnimationFrame(frame);

window.SproutSiege = { G, save, startLevel, update, draw, makeLevel, plant, dig, collectSun, PLANTS, ZOMBIES, get level() { return L; } };
})();

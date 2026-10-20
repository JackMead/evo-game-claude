// 001 Evo Blob: eat, grow, evolve, don't get eaten.
(() => {
'use strict';

// ---- Tuning: tweak freely --------------------------------------------------
const T = {
  world: 2400,            // world is world x world px
  foodCount: 140,
  enemyCount: 10,
  startRadius: 12,
  baseSpeed: 220,         // px/s at start size
  speedSizeExp: 0.35,     // bigger = slower
  foodArea: 12,           // area gained per pellet
  evolveCost: 8,          // points to first evolution
  evolveCostGrowth: 1.35, // each evolution costs this much more
  eatRatio: 1.15,         // must be this many times bigger to eat
  enemyMutateEvery: 25,   // seconds between rival evolutions
  senseRange: 260,        // how far cells notice things
};

// ---- Setup ----------------------------------------------------------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;
function resize() {
  const dpr = devicePixelRatio || 1;
  W = innerWidth; H = innerHeight;
  canvas.width = W * dpr; canvas.height = H * dpr;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize); resize();

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (a, b) => { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; };

// ---- Mutations -------------------------------------------------------------
const MUTATIONS = [
  { id: 'flagella', name: 'Flagella',   desc: '+25% speed',                                  apply: c => c.speedMul *= 1.25 },
  { id: 'cilia',    name: 'Cilia',      desc: 'Pull in nearby food',                         apply: c => c.magnet += 90 },
  { id: 'spikes',   name: 'Spikes',     desc: 'Cells a bit bigger than you get hurt trying to eat you', apply: c => c.spikes += 1 },
  { id: 'membrane', name: 'Membrane',   desc: 'Harder to eat: attackers must be much bigger', apply: c => c.armor += 0.25 },
  { id: 'camo',     name: 'Camouflage', desc: 'Others notice you 40% later',                 apply: c => c.camo *= 0.6 },
  { id: 'metab',    name: 'Metabolism', desc: 'Food gives +50% growth',                      apply: c => c.metab *= 1.5 },
  { id: 'eyespot',  name: 'Eyespot',    desc: 'See further (zooms out)',                     apply: c => c.sense *= 1.35 },
];
const MUT_BY_ID = Object.fromEntries(MUTATIONS.map(m => [m.id, m]));
function mutate(c, m) { m.apply(c); c.muts.push(m.id); }
const count = (c, id) => c.muts.filter(m => m === id).length;

// ---- Entities --------------------------------------------------------------
function makeCell(x, y, r, isPlayer) {
  return { x, y, r, vx: 0, vy: 0, isPlayer, alive: true, hurt: 0,
    speedMul: 1, magnet: 0, spikes: 0, armor: 0, camo: 1, metab: 1, sense: T.senseRange,
    muts: [], hue: isPlayer ? 185 : rand(0, 360), wander: rand(0, TAU), phase: rand(0, TAU) };
}
const speedOf = c => T.baseSpeed * c.speedMul * Math.pow(T.startRadius / c.r, T.speedSizeExp);
const canEat = (a, b) => a.r > b.r * (T.eatRatio + b.armor);
const spawnFood = () => ({ x: rand(0, T.world), y: rand(0, T.world) });

function spawnEnemy() {
  const p = S.player;
  let x, y;
  do { x = rand(0, T.world); y = rand(0, T.world); } while (Math.hypot(x - p.x, y - p.y) < 500);
  const e = makeCell(x, y, Math.max(6, p.r * rand(0.5, 1.7)), false);
  const n = Math.floor(S.t / 40); // late spawns arrive pre-evolved
  for (let i = 0; i < n; i++) mutate(e, pick(MUTATIONS));
  return e;
}

// ---- State -----------------------------------------------------------------
let S;
function reset() {
  S = { t: 0, player: makeCell(T.world / 2, T.world / 2, T.startRadius, true),
    enemies: [], food: [], points: 0, cost: T.evolveCost, choosing: null, cardRects: [],
    over: false, peak: T.startRadius, kills: 0, enemyMutT: 0, toasts: [] };
  for (let i = 0; i < T.foodCount; i++) S.food.push(spawnFood());
  for (let i = 0; i < T.enemyCount; i++) S.enemies.push(spawnEnemy());
}
function toast(text) { S.toasts.push({ text, t: 2.2 }); }

// ---- Input -----------------------------------------------------------------
const keys = {};
let mouse = null;
addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); keys[k] = true;
  if (S.choosing && '123'.includes(k)) choose(+k - 1);
  else if (S.over && (k === 'r' || k === ' ')) reset();
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
canvas.addEventListener('mousemove', e => { mouse = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('mouseleave', () => { mouse = null; });
canvas.addEventListener('touchmove', e => { const t = e.touches[0]; mouse = { x: t.clientX, y: t.clientY }; e.preventDefault(); }, { passive: false });
canvas.addEventListener('touchend', () => { mouse = null; });
canvas.addEventListener('click', e => {
  if (S.choosing) {
    const i = S.cardRects.findIndex(r => e.clientX >= r.x && e.clientX <= r.x + r.w && e.clientY >= r.y && e.clientY <= r.y + r.h);
    if (i >= 0) choose(i);
  } else if (S.over) reset();
});

function offerEvolution() {
  const pool = [...MUTATIONS].sort(() => Math.random() - 0.5);
  S.choosing = pool.slice(0, 3);
}
function choose(i) {
  const m = S.choosing[i]; if (!m) return;
  mutate(S.player, m);
  S.points -= S.cost; S.cost *= T.evolveCostGrowth;
  S.choosing = null; S.cardRects = [];
  toast('Evolved: ' + m.name);
}

// ---- Simulation ------------------------------------------------------------
function steer(c, dx, dy, throttle, dt) {
  const len = Math.hypot(dx, dy), sp = speedOf(c) * throttle;
  const tx = len > 1e-3 ? dx / len * sp : 0, ty = len > 1e-3 ? dy / len * sp : 0;
  const k = Math.min(1, dt * 6);
  c.vx += (tx - c.vx) * k; c.vy += (ty - c.vy) * k;
  c.x = clamp(c.x + c.vx * dt, c.r, T.world - c.r);
  c.y = clamp(c.y + c.vy * dt, c.r, T.world - c.r);
}

function think(e) {
  let threat = null, prey = null, td = Infinity, pd = Infinity;
  for (const o of [S.player, ...S.enemies]) {
    if (o === e || !o.alive) continue;
    const d = Math.sqrt(dist2(e, o));
    if (d > e.sense * o.camo + o.r) continue;
    if (canEat(o, e) && d < td) { td = d; threat = o; }
    else if (canEat(e, o) && d < pd) { pd = d; prey = o; }
  }
  if (threat) return [e.x - threat.x, e.y - threat.y, 1];
  if (prey) return [prey.x - e.x, prey.y - e.y, 1];
  let food = null, fd = e.sense * e.sense;
  for (const f of S.food) { const d = dist2(e, f); if (d < fd) { fd = d; food = f; } }
  if (food) return [food.x - e.x, food.y - e.y, 0.8];
  e.wander += rand(-0.15, 0.15);
  return [Math.cos(e.wander), Math.sin(e.wander), 0.5];
}

function grow(c, area, points) {
  c.r = Math.sqrt(c.r * c.r + area);
  if (c.isPlayer) S.points += points;
}

function eatFood(c, dt) {
  for (let i = S.food.length - 1; i >= 0; i--) {
    const f = S.food[i], d2 = dist2(c, f);
    if (c.magnet > 0 && d2 < (c.magnet + c.r) ** 2) {
      const d = Math.sqrt(d2) || 1, step = Math.min(d, 220 * dt);
      f.x += (c.x - f.x) / d * step; f.y += (c.y - f.y) / d * step;
    }
    if (d2 < c.r * c.r) { S.food[i] = spawnFood(); grow(c, T.foodArea * c.metab, c.metab); }
  }
}

function knock(a, b, force) {
  const d = Math.sqrt(dist2(a, b)) || 1, nx = (a.x - b.x) / d, ny = (a.y - b.y) / d;
  a.vx += nx * force; a.vy += ny * force; b.vx -= nx * force; b.vy -= ny * force;
}

function collide(a, b) {
  const d = Math.sqrt(dist2(a, b));
  if (d >= a.r + b.r) return;
  const [big, small] = a.r >= b.r ? [a, b] : [b, a];
  if (canEat(big, small)) {
    if (small.spikes > 0 && big.r < small.r * (1.4 + 0.4 * small.spikes)) {
      if (big.hurt <= 0) { big.r = Math.max(6, big.r * 0.85); big.hurt = 0.4; small.hurt = 0.2; knock(small, big, 350); }
      return;
    }
    if (d < big.r) {
      small.alive = false;
      grow(big, small.r * small.r * 0.6, Math.max(2, small.r / 4));
      if (big.isPlayer) { S.kills++; }
    }
    return;
  }
  // Neither can eat: push apart.
  const overlap = a.r + b.r - d, nx = (a.x - b.x) / (d || 1), ny = (a.y - b.y) / (d || 1);
  const ta = b.r / (a.r + b.r), tb = 1 - ta;
  a.x += nx * overlap * ta; a.y += ny * overlap * ta;
  b.x -= nx * overlap * tb; b.y -= ny * overlap * tb;
}

function update(dt) {
  for (const t of S.toasts) t.t -= dt;
  S.toasts = S.toasts.filter(t => t.t > 0);
  if (S.over || S.choosing) return;
  S.t += dt;
  const p = S.player;

  let dx = 0, dy = 0, throttle = 1;
  if (keys.w || keys.arrowup) dy -= 1;
  if (keys.s || keys.arrowdown) dy += 1;
  if (keys.a || keys.arrowleft) dx -= 1;
  if (keys.d || keys.arrowright) dx += 1;
  if (!dx && !dy && mouse) { dx = mouse.x - W / 2; dy = mouse.y - H / 2; throttle = Math.min(1, Math.hypot(dx, dy) / 120); }
  steer(p, dx, dy, throttle, dt);
  for (const e of S.enemies) { const [x, y, t] = think(e); steer(e, x, y, t, dt); }

  const cells = [p, ...S.enemies];
  for (const c of cells) eatFood(c, dt);
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++)
      if (cells[i].alive && cells[j].alive) collide(cells[i], cells[j]);
  for (const c of cells) c.hurt = Math.max(0, c.hurt - dt);

  S.enemies = S.enemies.filter(e => e.alive);
  if (!p.alive) { S.over = true; return; }
  while (S.enemies.length < T.enemyCount) S.enemies.push(spawnEnemy());

  S.enemyMutT += dt;
  if (S.enemyMutT >= T.enemyMutateEvery) {
    S.enemyMutT = 0;
    for (const e of S.enemies) mutate(e, pick(MUTATIONS));
    toast('Rivals evolved!');
  }
  S.peak = Math.max(S.peak, p.r);
  if (S.points >= S.cost) offerEvolution();
}

// ---- Rendering -------------------------------------------------------------
const zoomFor = p => clamp(1.3 * Math.pow(T.startRadius / p.r, 0.45), 0.2, 1.3) / Math.sqrt(p.sense / T.senseRange);

function drawCell(c) {
  const p = S.player;
  ctx.save(); ctx.translate(c.x, c.y);
  ctx.globalAlpha = c.camo < 1 ? 0.35 + 0.65 * c.camo : 1;
  const ang = Math.hypot(c.vx, c.vy) > 5 ? Math.atan2(c.vy, c.vx) : c.wander;
  c.phase += 0.25;

  const fl = count(c, 'flagella');
  if (fl) {
    ctx.strokeStyle = `hsl(${c.hue},60%,72%)`; ctx.lineWidth = Math.max(1.5, c.r * 0.1);
    for (let k = 0; k < fl; k++) {
      const off = (k - (fl - 1) / 2) * 0.35;
      ctx.beginPath();
      for (let s = 0; s <= 12; s++) {
        const along = c.r + s * c.r * 0.12, wob = Math.sin(c.phase + s * 0.8) * c.r * 0.15;
        const a = ang + Math.PI + off;
        const x = Math.cos(a) * along - Math.sin(a) * wob, y = Math.sin(a) * along + Math.cos(a) * wob;
        s ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
  }
  if (c.spikes) {
    ctx.fillStyle = `hsl(${c.hue},30%,85%)`;
    const n = 8 + c.spikes * 4, len = c.r * (0.25 + 0.1 * c.spikes);
    ctx.beginPath();
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU, w = TAU / n * 0.3;
      ctx.moveTo(Math.cos(a - w) * c.r, Math.sin(a - w) * c.r);
      ctx.lineTo(Math.cos(a) * (c.r + len), Math.sin(a) * (c.r + len));
      ctx.lineTo(Math.cos(a + w) * c.r, Math.sin(a + w) * c.r);
    }
    ctx.fill();
  }
  if (c.magnet) {
    ctx.strokeStyle = `hsla(${c.hue},60%,80%,0.6)`; ctx.lineWidth = 1;
    ctx.beginPath();
    const n = 24;
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU + Math.sin(c.phase * 0.3 + k) * 0.05;
      ctx.moveTo(Math.cos(a) * c.r, Math.sin(a) * c.r);
      ctx.lineTo(Math.cos(a) * (c.r + 5), Math.sin(a) * (c.r + 5));
    }
    ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, 0, c.r, 0, TAU);
  ctx.fillStyle = `hsl(${c.hue},60%,${c.hurt > 0 ? 78 : 48}%)`; ctx.fill();
  ctx.lineWidth = Math.min(2 + c.armor * 8, c.r * 0.35);
  ctx.strokeStyle = c.isPlayer ? '#ffffff' : canEat(c, p) ? '#ff4d4d' : canEat(p, c) ? '#8dff9a' : '#c9d6d4';
  ctx.stroke();
  // nucleus + eyespot
  ctx.fillStyle = `hsla(${c.hue},50%,25%,0.6)`;
  ctx.beginPath(); ctx.arc(-Math.cos(ang) * c.r * 0.2, -Math.sin(ang) * c.r * 0.2, c.r * 0.35, 0, TAU); ctx.fill();
  const eyes = count(c, 'eyespot');
  if (eyes || c.isPlayer) {
    ctx.fillStyle = eyes ? '#ffe36b' : '#0b1418';
    ctx.beginPath(); ctx.arc(Math.cos(ang) * c.r * 0.55, Math.sin(ang) * c.r * 0.55, c.r * (0.12 + 0.05 * eyes), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function wrap(text, x, y, maxW, lh) {
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = w; } else line = t;
  }
  if (line) ctx.fillText(line, x, y);
}

function draw() {
  const p = S.player, z = zoomFor(p);
  ctx.fillStyle = '#0b1418'; ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-p.x, -p.y);

  // grid + border
  const x0 = p.x - W / 2 / z, x1 = p.x + W / 2 / z, y0 = p.y - H / 2 / z, y1 = p.y + H / 2 / z;
  ctx.strokeStyle = '#13242a'; ctx.lineWidth = 1 / z; ctx.beginPath();
  for (let x = Math.max(0, Math.floor(x0 / 100) * 100); x <= Math.min(T.world, x1); x += 100) { ctx.moveTo(x, Math.max(0, y0)); ctx.lineTo(x, Math.min(T.world, y1)); }
  for (let y = Math.max(0, Math.floor(y0 / 100) * 100); y <= Math.min(T.world, y1); y += 100) { ctx.moveTo(Math.max(0, x0), y); ctx.lineTo(Math.min(T.world, x1), y); }
  ctx.stroke();
  ctx.strokeStyle = '#2c5560'; ctx.lineWidth = 4 / z; ctx.strokeRect(0, 0, T.world, T.world);

  ctx.fillStyle = '#7fdc8a'; ctx.beginPath();
  for (const f of S.food) { ctx.moveTo(f.x + 4, f.y); ctx.arc(f.x, f.y, 4, 0, TAU); }
  ctx.fill();

  const cells = [...S.enemies, ...(p.alive ? [p] : [])].sort((a, b) => a.r - b.r);
  for (const c of cells) drawCell(c);
  ctx.restore();

  // HUD
  ctx.font = '14px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#e8f4f2';
  ctx.fillText(`Size ${p.r.toFixed(0)}   Time ${S.t.toFixed(0)}s   Eaten ${S.kills}`, 16, 26);
  ctx.fillStyle = '#21343a'; ctx.fillRect(16, 36, 200, 8);
  ctx.fillStyle = '#7fdcc8'; ctx.fillRect(16, 36, 200 * clamp(S.points / S.cost, 0, 1), 8);
  ctx.fillStyle = '#8aa'; ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`Next evolution · rivals evolve in ${Math.ceil(T.enemyMutateEvery - S.enemyMutT)}s`, 16, 60);
  const ids = [...new Set(p.muts)];
  ids.forEach((id, i) => { const n = count(p, id); ctx.fillText(MUT_BY_ID[id].name + (n > 1 ? ' ×' + n : ''), 16, 82 + i * 16); });

  ctx.textAlign = 'center'; ctx.font = 'bold 18px system-ui, sans-serif';
  S.toasts.forEach((t, i) => { ctx.globalAlpha = clamp(t.t, 0, 1); ctx.fillStyle = '#ffe36b'; ctx.fillText(t.text, W / 2, 80 + i * 26); });
  ctx.globalAlpha = 1;

  if (S.choosing) drawChoices();
  if (S.over) {
    ctx.fillStyle = 'rgba(5,10,12,0.75)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 40px system-ui, sans-serif'; ctx.fillText('Eaten.', W / 2, H / 2 - 40);
    ctx.fillStyle = '#e8f4f2'; ctx.font = '16px system-ui, sans-serif';
    ctx.fillText(`Survived ${S.t.toFixed(0)}s · peak size ${S.peak.toFixed(0)} · ate ${S.kills} cells · ${p.muts.length} mutations`, W / 2, H / 2);
    ctx.fillStyle = '#8aa'; ctx.fillText('Click or press R to try again', W / 2, H / 2 + 34);
  }
}

function drawChoices() {
  ctx.fillStyle = 'rgba(5,10,12,0.7)'; ctx.fillRect(0, 0, W, H);
  const n = S.choosing.length, gap = 16, cw = Math.min(220, (W - 32 - gap * (n - 1)) / n), ch = 140;
  const total = n * cw + (n - 1) * gap, x0 = (W - total) / 2, y = H / 2 - ch / 2;
  ctx.textAlign = 'center'; ctx.fillStyle = '#7fdcc8'; ctx.font = 'bold 28px system-ui, sans-serif';
  ctx.fillText('Evolve!', W / 2, y - 24);
  S.cardRects = S.choosing.map((m, i) => {
    const x = x0 + i * (cw + gap);
    ctx.fillStyle = '#16282e'; ctx.strokeStyle = '#7fdcc8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(x, y, cw, ch, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8f4f2'; ctx.font = 'bold 18px system-ui, sans-serif'; ctx.fillText(m.name, x + cw / 2, y + 34);
    ctx.fillStyle = '#a9c0bd'; ctx.font = '13px system-ui, sans-serif'; wrap(m.desc, x + cw / 2, y + 62, cw - 24, 18);
    ctx.fillStyle = '#5b7a7a'; ctx.fillText(`[${i + 1}]`, x + cw / 2, y + ch - 14);
    return { x, y, w: cw, h: ch };
  });
}

// ---- Loop ------------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); draw();
  requestAnimationFrame(frame);
}
reset();
requestAnimationFrame(frame);

// Debug/console access: game.state, game.T, game.mutate(game.state.player, game.MUTATIONS[0])
window.game = { T, get state() { return S; }, reset, mutate, MUTATIONS };
})();

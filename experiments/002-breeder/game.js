// 002 Breeder: pair creatures to breed a herd through hostile seasons.
// Each world has hidden rules linking visible traits to nasty side effects.
(() => {
'use strict';
const params = new URLSearchParams(location.search);

// ---- Tuning: tweak freely --------------------------------------------------
const T = {
  seasons: 12,          // survive this many to win
  startPop: 8,
  capacity: 14,         // above this, overcrowding raises everyone's death risk
  lifespan: 4,          // seasons; elders likely die after this
  seasonSeconds: 7,     // how long a season takes to play out
  offspringPerPair: 2,
  mutation: 0.08,       // gene noise per generation
  baseRisk: 0.03,       // background death chance per season
  envRisk: 0.55,        // max extra death chance from a badly-suited environment
  overcrowdRisk: 0.04,  // extra death chance per creature over capacity
  cursesPerRun: 2,      // hidden trait->problem links per world
  blightCarriers: 3,    // starting creatures carrying the hidden recessive blight gene
  showStats: params.has('stats'), // ?stats shows gene numbers in the tooltip
};

// ---- Helpers ---------------------------------------------------------------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const vr = (a, b) => a + Math.random() * (b - a); // visual-only randomness
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// Seeded RNG for game logic, so a world can be replayed with ?seed=N
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
let rnd = Math.random;
const rr = (a, b) => a + rnd() * (b - a);
const pickR = arr => arr[Math.floor(rnd() * arr.length)];
const gauss = () => { let u = 0; while (!u) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rnd()); };
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---- World rules -------------------------------------------------------------
const CURSES = {
  madness:   { name: 'Giant madness',    desc: 'Large creatures may go mad and attack the nearest herd member (worse with a hidden bad temper).' },
  weakHeart: { name: 'Racing hearts',    desc: 'Very fast creatures may collapse from heart failure (worse with low hidden vigour).' },
  sterile:   { name: 'Fluffy sterility', desc: 'Very fluffy creatures often fail to have offspring.' },
};
const ENVS = {
  mild:      { name: 'Mild season',  desc: 'Calm weather, plenty of food.', tint: '#15241a', verb: null,                       risk: () => 0 },
  cold:      { name: 'Harsh winter', desc: 'Thin fur freezes.',             tint: '#132131', verb: 'froze to death',           risk: c => Math.max(0, 0.55 - c.g.fur) / 0.55 },
  heat:      { name: 'Heatwave',     desc: 'Thick fur overheats.',          tint: '#2c1d11', verb: 'overheated',               risk: c => Math.max(0, c.g.fur - 0.45) / 0.55 },
  predators: { name: 'Predators',    desc: 'Slow creatures get caught.',    tint: '#281416', verb: 'was caught by a predator', risk: c => Math.max(0, 0.55 - c.g.speed) / 0.55 },
  famine:    { name: 'Famine',       desc: 'Big bodies starve.',            tint: '#25210f', verb: 'starved',                  risk: c => Math.max(0, c.g.size - 0.45) / 0.55 },
};
function rollForecast() {
  const w = { mild: 1, cold: 1.25, heat: 1.25, predators: 1.25, famine: 1.25 };
  let x = rnd() * Object.values(w).reduce((a, b) => a + b);
  for (const k in w) { x -= w[k]; if (x <= 0) return k; }
  return 'mild';
}

// ---- Creatures ---------------------------------------------------------------
const SYL = ['ka', 'lo', 'mi', 'zu', 'ra', 'po', 'ne', 'ti', 'gru', 'bo', 'fi', 'sha', 'do', 've', 'pip', 'mo', 'tak', 'lu', 'ber', 'nix'];
const makeName = () => { const n = SYL[Math.floor(Math.random() * SYL.length)] + SYL[Math.floor(Math.random() * SYL.length)]; return n[0].toUpperCase() + n.slice(1); };
const WORDS = {
  size:  ['tiny', 'small', 'medium', 'large', 'huge'],
  speed: ['sluggish', 'slow', 'steady', 'quick', 'very fast'],
  fur:   ['bald', 'thin fur', 'some fur', 'fluffy', 'very fluffy'],
};
const word = (k, v) => WORDS[k][Math.min(4, Math.floor(v * 5))];
const describe = c => `${word('size', c.g.size)}, ${word('speed', c.g.speed)}, ${word('fur', c.g.fur)}`;
const ageWord = c => c.age === 0 ? 'baby' : c.age >= T.lifespan ? 'elder' : 'adult';
const living = () => S.creatures.filter(c => c.alive);
const rad = c => (12 + c.g.size * 30) * (c.age === 0 ? 0.7 : 1) * (0.3 + 0.7 * c.spawn);

const PAD = 40;
let PW = 600, PH = 400;
function newTarget(c) { c.tx = vr(PAD, PW - PAD); c.ty = vr(PAD, PH - PAD); }
function makeCreature(g, blight, x, y) {
  const c = { id: Math.random(), name: makeName(), g, blight, age: 0, alive: true, dying: 0, mad: false, spawn: 1,
    x: x ?? vr(PAD, PW - PAD), y: y ?? vr(PAD, PH - PAD), tx: 0, ty: 0, pause: vr(0, 2), phase: vr(0, TAU), moving: 0 };
  newTarget(c);
  return c;
}

function breed(a, b) {
  const mix = (x, y) => clamp(lerp(x, y, rnd()) + gauss() * T.mutation, 0, 1);
  const sterileP = c => S.curses.includes('sterile') ? clamp((c.g.fur - 0.6) / 0.4, 0, 1) * 0.85 : 0;
  const pFail = Math.max(sterileP(a), sterileP(b));
  const kids = [];
  for (let i = 0; i < T.offspringPerPair; i++) {
    if (rnd() < pFail) continue;
    const g = { size: mix(a.g.size, b.g.size), speed: mix(a.g.speed, b.g.speed), fur: mix(a.g.fur, b.g.fur),
      hue: (lerp(a.g.hue, b.g.hue, rnd()) + gauss() * 12 + 360) % 360,
      temper: mix(a.g.temper, b.g.temper), vigor: mix(a.g.vigor, b.g.vigor) };
    const k = makeCreature(g, [pickR(a.blight), pickR(b.blight)], (a.x + b.x) / 2 + vr(-20, 20), (a.y + b.y) / 2 + vr(-20, 20));
    k.spawn = 0;
    kids.push(k);
  }
  return kids;
}

// ---- State -------------------------------------------------------------------
let S;
function newWorld(seed) {
  seed = seed ?? Math.floor(Math.random() * 1e6);
  rnd = mulberry32(seed);
  S = { seed, curses: shuffle(Object.keys(CURSES)).slice(0, T.cursesPerRun),
    season: 1, phase: 'plan', forecast: 'mild', creatures: [], pairs: [], sel: null, hover: null,
    events: [], seasonT: 0, chases: [], floats: [], log: [], deaths: {}, peak: 0, result: null };
  for (let i = 0; i < T.startPop; i++) {
    const c = makeCreature({ size: rr(0.2, 0.8), speed: rr(0.2, 0.8), fur: rr(0.2, 0.8), hue: rr(0, 360), temper: rr(0, 1), vigor: rr(0.2, 1) }, [0, 0]);
    c.age = 1;
    S.creatures.push(c);
  }
  shuffle([...S.creatures]).slice(0, T.blightCarriers).forEach(c => { c.blight[0] = 1; });
  S.peak = S.creatures.length;
  addLog(`<b>Your herd of ${S.creatures.length} arrives.</b> Survive ${T.seasons} seasons. Hover a creature to inspect it; click two to pair them.`, 'sys');
  updatePanel();
}

function addLog(html, cls) { S.log.unshift({ html, cls }); if (S.log.length > 200) S.log.pop(); }
const tag = c => `<b style="color:hsl(${c.g.hue.toFixed(0)},70%,72%)">${c.name}</b> <i>(${describe(c)})</i>`;
function float(x, y, text, color) { S.floats.push({ x, y, text, color, t: 1.6 }); }
const partnerOf = c => { const p = S.pairs.find(p => p.includes(c)); return p ? (p[0] === c ? p[1] : p[0]) : null; };

// ---- Seasons -----------------------------------------------------------------
function startSeason() {
  if (S.phase !== 'plan') return;
  S.phase = 'season'; S.seasonT = 0; S.sel = null;
  const env = ENVS[S.forecast];
  addLog(`<b>Season ${S.season}: ${env.name}.</b>` + (S.pairs.length ? ` ${S.pairs.length} pair${S.pairs.length > 1 ? 's' : ''} trying for young.` : ' No pairs breeding.'), 'sys');
  S.events = planEvents();
  updatePanel();
}

function planEvents() {
  const env = ENVS[S.forecast], alive = living(), over = Math.max(0, alive.length - T.capacity);
  const ev = [], at = () => rr(0.6, T.seasonSeconds - 1.2);
  for (const c of alive) {
    const frailty = 1.3 - 0.6 * c.g.vigor;
    if (c.age >= T.lifespan && rnd() < 0.6 + 0.2 * (c.age - T.lifespan)) ev.push({ t: at(), type: 'die', c, cause: 'died of old age', key: 'old age' });
    const envR = T.envRisk * env.risk(c);
    if (rnd() < (T.baseRisk + envR + over * T.overcrowdRisk) * frailty) {
      const [cause, key] = envR > 0.05 ? [env.verb, env.name] : over ? ['starved in the overcrowding', 'overcrowding'] : ['fell ill and died', 'illness'];
      ev.push({ t: at(), type: 'die', c, cause, key });
    }
    if (S.curses.includes('madness')) {
      const p = 0.7 * Math.max(0, c.g.size - 0.55) / 0.45 * (0.5 + c.g.temper);
      if (rnd() < p) ev.push({ t: at(), type: 'mad', c });
    }
    if (S.curses.includes('weakHeart')) {
      const p = 0.6 * Math.max(0, c.g.speed - 0.6) / 0.4 * (1.3 - c.g.vigor);
      if (rnd() < p) ev.push({ t: at(), type: 'die', c, cause: 'collapsed suddenly; its heart gave out', key: 'heart failure' });
    }
  }
  return ev.sort((a, b) => a.t - b.t);
}

function kill(c, cause, key) {
  if (!c.alive) return;
  c.alive = false; c.mad = false;
  S.deaths[key] = (S.deaths[key] || 0) + 1;
  addLog(`${tag(c)} ${cause}.`, 'death');
  float(c.x, c.y - rad(c) - 12, '✝', '#ff9b9b');
  updatePanel();
}

function updateSeason(dt) {
  S.seasonT += dt;
  while (S.events.length && S.events[0].t <= S.seasonT) {
    const e = S.events.shift();
    if (!e.c.alive) continue;
    if (e.type === 'die') kill(e.c, e.cause, e.key);
    else if (e.type === 'mad') {
      const others = living().filter(o => o !== e.c);
      if (!others.length) continue;
      const victim = others.reduce((best, o) => dist(o, e.c) < dist(best, e.c) ? o : best);
      e.c.mad = true;
      S.chases.push({ a: e.c, v: victim, t: 0 });
      addLog(`${tag(e.c)} went mad!`, 'mad');
      float(e.c.x, e.c.y - rad(e.c) - 12, '!!', '#ff5a4a');
      updatePanel();
    }
  }
  for (const ch of S.chases) {
    ch.t += dt;
    if (!ch.a.alive || !ch.v.alive) { ch.done = true; continue; }
    const d = dist(ch.a, ch.v), step = Math.min(d, 280 * dt);
    ch.a.x += (ch.v.x - ch.a.x) / (d || 1) * step; ch.a.y += (ch.v.y - ch.a.y) / (d || 1) * step;
    if (d < rad(ch.a) + rad(ch.v) || ch.t > 2.5) {
      ch.done = true;
      if (ch.v.g.size > ch.a.g.size * 0.85) { addLog(`${tag(ch.v)} fought off ${ch.a.name}.`, 'mad'); float(ch.v.x, ch.v.y - rad(ch.v) - 12, 'blocked!', '#f2c14e'); }
      else kill(ch.v, `was mauled by ${ch.a.name}`, 'mauled by a mad creature');
      updatePanel();
    }
  }
  S.chases = S.chases.filter(ch => !ch.done);
  if (S.seasonT >= T.seasonSeconds && !S.chases.length && !S.events.length) endSeason();
}

function endSeason() {
  const born = [];
  for (const [a, b] of S.pairs) {
    if (!a.alive || !b.alive) { addLog(`No young for ${a.name} & ${b.name}: ${!a.alive ? a.name : b.name} didn't make it.`, 'sys'); continue; }
    const kids = breed(a, b);
    const healthy = [];
    for (const k of kids) {
      if (k.blight[0] && k.blight[1]) {
        addLog(`A baby of ${a.name} & ${b.name} was born sickly and died.`, 'death');
        S.deaths['born sickly'] = (S.deaths['born sickly'] || 0) + 1;
        float(k.x, k.y - 20, '✝', '#ff9b9b');
      } else healthy.push(k);
    }
    if (healthy.length) addLog(`${a.name} & ${b.name} had ${healthy.map(tag).join(' and ')}.`, 'birth');
    else if (!kids.length) addLog(`${a.name} & ${b.name} had no offspring.`, 'sys');
    born.push(...healthy);
  }
  for (const c of living()) { c.age++; c.mad = false; }
  S.creatures.push(...born);
  S.pairs = [];
  const n = living().length;
  S.peak = Math.max(S.peak, n);
  if (n < 2) return endGame(false);
  if (S.season >= T.seasons) return endGame(true);
  S.season++;
  S.forecast = rollForecast();
  S.phase = 'plan';
  addLog(`<b>Coming up: ${ENVS[S.forecast].name}.</b> Choose pairs to breed.`, 'sys');
  updatePanel();
}

function endGame(win) {
  S.phase = 'over'; S.result = win ? 'win' : 'lose';
  addLog(win ? `<b>Your herd survived all ${T.seasons} seasons!</b>` : `<b>Your herd can no longer breed. It has died out.</b>`, 'sys');
  updatePanel();
}

// ---- Panel (DOM) -------------------------------------------------------------
const $ = s => document.querySelector(s);
function updatePanel() {
  const env = ENVS[S.forecast], n = living().length;
  $('#seasonLabel').textContent = S.phase === 'over' ? 'Game over' : `Season ${S.season} of ${T.seasons}`;
  if (S.phase === 'over') {
    const deaths = Object.entries(S.deaths).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v}× ${k}`).join(', ') || 'none';
    $('#forecast').innerHTML = `<h3>${S.result === 'win' ? 'Your herd survived!' : 'Your herd died out.'}</h3>
      <div class="desc">Lasted ${S.season} season${S.season > 1 ? 's' : ''} · peak herd ${S.peak}</div>
      <p><b>This world's hidden rules:</b></p>
      <ul>${S.curses.map(k => `<li><b>${CURSES[k].name}</b>: ${CURSES[k].desc}</li>`).join('')}
      <li><b>Blight</b>: a hidden recessive gene. Two carriers can have sickly young.</li></ul>
      <div class="desc">Deaths: ${deaths}</div>`;
  } else {
    $('#forecast').innerHTML = `<div class="label">${S.phase === 'season' ? 'This season' : 'Coming season'}</div>
      <div class="env">${env.name}</div><div class="desc">${env.desc}</div>`;
  }
  $('#hint').textContent = S.phase === 'plan' ? 'Click two adults to pair them for breeding. Click a paired creature to unpair it. Babies are too young to breed.'
    : S.phase === 'season' ? 'The season is playing out…' : '';
  const go = $('#go'), alt = $('#alt');
  go.disabled = S.phase === 'season';
  go.textContent = S.phase === 'plan' ? `Start season (${S.pairs.length} pair${S.pairs.length === 1 ? '' : 's'})` : S.phase === 'season' ? 'Season under way…' : 'New world';
  alt.hidden = S.phase !== 'over';
  alt.textContent = 'Replay this world';
  $('#pop').textContent = `Herd: ${n} · overcrowded above ${T.capacity}`;
  $('#log').innerHTML = S.log.map(l => `<div class="${l.cls}">${l.html}</div>`).join('');
  $('#seedLabel').textContent = `World #${S.seed}`;
}
$('#go').addEventListener('click', () => { if (S.phase === 'plan') startSeason(); else if (S.phase === 'over') newWorld(); });
$('#alt').addEventListener('click', () => newWorld(S.seed));
addEventListener('keydown', e => { if (e.key === ' ' && S.phase === 'plan') { e.preventDefault(); startSeason(); } });

// ---- Pen (canvas) ------------------------------------------------------------
const canvas = $('#pen'), ctx = canvas.getContext('2d');
function resize() {
  const r = $('#penWrap').getBoundingClientRect(), dpr = devicePixelRatio || 1;
  PW = Math.max(200, r.width); PH = Math.max(200, r.height);
  canvas.width = PW * dpr; canvas.height = PH * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (S) for (const c of S.creatures) { c.x = clamp(c.x, PAD, PW - PAD); c.y = clamp(c.y, PAD, PH - PAD); newTarget(c); }
}
new ResizeObserver(resize).observe($('#penWrap'));
resize();

function creatureAt(x, y) {
  const list = living().sort((a, b) => b.y - a.y);
  return list.find(c => Math.hypot(c.x - x, c.y - y) < rad(c) + 6) || null;
}
const pointer = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
let mouse = null;
canvas.addEventListener('mousemove', e => { mouse = pointer(e); S.hover = creatureAt(mouse.x, mouse.y); });
canvas.addEventListener('mouseleave', () => { mouse = null; S.hover = null; });
canvas.addEventListener('click', e => {
  if (S.phase !== 'plan') return;
  const p = pointer(e), c = creatureAt(p.x, p.y);
  if (!c) { S.sel = null; return; }
  const pi = S.pairs.findIndex(p => p.includes(c));
  if (pi >= 0) { S.pairs.splice(pi, 1); S.sel = null; }
  else if (c.age === 0) float(c.x, c.y - rad(c) - 12, 'too young', '#8fa49a');
  else if (!S.sel) S.sel = c;
  else if (S.sel === c) S.sel = null;
  else { S.pairs.push([S.sel, c]); S.sel = null; }
  updatePanel();
});

function updateMove(dt) {
  for (const c of S.creatures) {
    c.spawn = Math.min(1, c.spawn + dt * 2);
    if (!c.alive) { c.dying += dt * 0.7; continue; }
    if (S.chases.some(ch => ch.a === c)) { c.phase += dt * 16; c.moving = 1; continue; }
    const p0 = S.phase !== 'over' ? partnerOf(c) : null, partner = p0 && p0.alive ? p0 : null;
    const tx = partner ? partner.x : c.tx, ty = partner ? partner.y : c.ty;
    const stopAt = partner ? rad(c) + rad(partner) + 4 : 4;
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
    const sp = (15 + c.g.speed * 55) * (c.mad ? 2 : 1);
    if (c.pause > 0 && !partner) { c.pause -= dt; c.moving = Math.max(0, c.moving - dt * 3); }
    else if (d <= stopAt) { if (!partner) { newTarget(c); c.pause = vr(0.3, 2.5); } c.moving = Math.max(0, c.moving - dt * 3); }
    else { const s = Math.min(d - stopAt, sp * dt); c.x += dx / d * s; c.y += dy / d * s; c.moving = Math.min(1, c.moving + dt * 3); }
    c.phase += dt * (3 + c.g.speed * 10) * c.moving;
    c.x = clamp(c.x, PAD, PW - PAD); c.y = clamp(c.y, PAD, PH - PAD);
  }
  S.creatures = S.creatures.filter(c => c.alive || c.dying < 1);
  for (const f of S.floats) { f.t -= dt; f.y -= dt * 18; }
  S.floats = S.floats.filter(f => f.t > 0);
}

function drawCreature(c) {
  const r = rad(c), elder = c.age >= T.lifespan;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.globalAlpha = c.alive ? 1 : Math.max(0, 1 - c.dying);
  const bob = Math.sin(c.phase * 2) * 1.5 * c.moving;
  const sat = c.alive ? (elder ? 18 : 55) : 0, light = elder ? 45 : 55;
  const body = c.mad ? `hsl(${Math.sin(c.phase) > 0 ? 0 : 10},80%,52%)` : `hsl(${c.g.hue},${sat}%,${light}%)`;

  // legs: more and longer legs = faster
  const legs = 2 + Math.round(c.g.speed * 4), legLen = r * 0.35 + 3 + c.g.speed * 6;
  ctx.strokeStyle = `hsl(${c.g.hue},${sat * 0.6}%,28%)`; ctx.lineWidth = Math.max(2, r * 0.1); ctx.lineCap = 'round';
  for (let i = 0; i < legs; i++) {
    const lx = (legs === 1 ? 0 : i / (legs - 1) - 0.5) * r * 1.2, swing = Math.sin(c.phase * 2 + i * 1.7) * r * 0.25 * c.moving;
    ctx.beginPath(); ctx.moveTo(lx, r * 0.5); ctx.lineTo(lx + swing, r * 0.5 + legLen); ctx.stroke();
  }
  ctx.translate(0, bob);
  // fur: more and longer tufts = fluffier
  if (c.g.fur > 0.12) {
    const n = Math.round(12 + c.g.fur * 34), len = 1 + c.g.fur * 10;
    ctx.strokeStyle = `hsl(${c.g.hue},${sat}%,${light + 15}%)`; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU + 0.1 * Math.sin(i * 7.3);
      const ex = Math.cos(a) * r, ey = Math.sin(a) * r * 0.85;
      ctx.moveTo(ex, ey); ctx.lineTo(ex + Math.cos(a) * len, ey + Math.sin(a) * len);
    }
    ctx.stroke();
  }
  ctx.fillStyle = body;
  ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.85, 0, 0, TAU); ctx.fill();
  // eyes
  const face = Math.cos(c.phase * 0.2) > 0 ? 1 : -1, ex = r * 0.3 * face, ey = -r * 0.2, er = Math.max(2, r * 0.17);
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + s * r * 0.25, ey, er, 0, TAU); ctx.fill();
    ctx.fillStyle = c.mad ? '#d00' : '#111'; ctx.beginPath(); ctx.arc(ex + s * r * 0.25 + face * er * 0.3, ey, er * 0.55, 0, TAU); ctx.fill();
  }
  if (!c.alive) { ctx.strokeStyle = '#111'; ctx.lineWidth = 2; for (const s of [-1, 1]) { const x = ex + s * r * 0.25; ctx.beginPath(); ctx.moveTo(x - er, ey - er); ctx.lineTo(x + er, ey + er); ctx.moveTo(x + er, ey - er); ctx.lineTo(x - er, ey + er); ctx.stroke(); } }
  ctx.restore();

  // label + selection
  ctx.textAlign = 'center'; ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = 'rgba(230,239,233,0.7)';
  if (c.alive) ctx.fillText(c.name + (c.age === 0 ? ' ·baby' : elder ? ' ·elder' : ''), c.x, c.y + r + legLen + 12);
  if (c === S.sel || c === S.hover) {
    ctx.strokeStyle = c === S.sel ? '#f2c14e' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(c.x, c.y, r + 10, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  }
}

function drawHeart(x, y, s) {
  ctx.fillStyle = '#ff6b9a'; ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.4, y - s, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.4, y - s, x + s, y - s * 0.4, x, y + s * 0.35);
  ctx.fill();
}

function drawTooltip(c) {
  const lines = [`${c.name}: ${ageWord(c)}, age ${c.age}`, describe(c)];
  if (T.showStats) lines.push(`size ${c.g.size.toFixed(2)}  speed ${c.g.speed.toFixed(2)}  fur ${c.g.fur.toFixed(2)}`);
  const p = partnerOf(c); if (p) lines.push(`paired with ${p.name}`);
  ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'left';
  const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 16, h = lines.length * 16 + 10;
  let x = c.x + rad(c) + 14, y = c.y - h / 2;
  if (x + w > PW - 4) x = c.x - rad(c) - 14 - w;
  y = clamp(y, 4, PH - h - 4);
  ctx.fillStyle = 'rgba(10,16,13,0.92)'; ctx.strokeStyle = '#2f4239'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill(); ctx.stroke();
  lines.forEach((l, i) => { ctx.fillStyle = i ? '#a9bcb2' : '#e6efe9'; ctx.fillText(l, x + 8, y + 18 + i * 16); });
}

const flakes = Array.from({ length: 60 }, () => ({ x: Math.random(), y: Math.random(), s: vr(0.5, 1.5) }));
function draw() {
  const env = ENVS[S.forecast];
  ctx.fillStyle = env.tint; ctx.fillRect(0, 0, PW, PH);
  // weather particles hint at the season
  if (S.forecast === 'cold' || S.forecast === 'heat') {
    ctx.fillStyle = S.forecast === 'cold' ? 'rgba(220,235,255,0.5)' : 'rgba(255,150,60,0.35)';
    for (const f of flakes) {
      f.y += (S.forecast === 'cold' ? 0.0015 : -0.001) * f.s;
      if (f.y > 1) f.y = 0; if (f.y < 0) f.y = 1;
      ctx.beginPath(); ctx.arc(f.x * PW, f.y * PH, 1.5 * f.s, 0, TAU); ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 3; ctx.setLineDash([12, 8]);
  ctx.strokeRect(PAD / 2, PAD / 2, PW - PAD, PH - PAD); ctx.setLineDash([]);

  for (const [a, b] of S.pairs) {
    ctx.strokeStyle = 'rgba(255,107,154,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    drawHeart((a.x + b.x) / 2, (a.y + b.y) / 2 - 4, 9);
  }
  for (const c of [...S.creatures].sort((a, b) => a.y - b.y)) drawCreature(c);

  ctx.textAlign = 'center'; ctx.font = 'bold 16px system-ui, sans-serif';
  for (const f of S.floats) { ctx.globalAlpha = clamp(f.t, 0, 1); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
  ctx.globalAlpha = 1;

  if (S.phase === 'season') {
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(PAD / 2, 8, PW - PAD, 5);
    ctx.fillStyle = '#f2c14e'; ctx.fillRect(PAD / 2, 8, (PW - PAD) * clamp(S.seasonT / T.seasonSeconds, 0, 1), 5);
  }
  if (S.hover && S.hover.alive) drawTooltip(S.hover);
}

// ---- Loop --------------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S.phase === 'season') updateSeason(dt);
  updateMove(dt);
  draw();
  requestAnimationFrame(frame);
}
newWorld(params.has('seed') ? +params.get('seed') : undefined);
requestAnimationFrame(frame);

// Console access: game.state, game.T, game.startSeason(), game.pair(a, b)
window.game = { T, get state() { return S; }, newWorld, startSeason, CURSES, ENVS,
  pair: (a, b) => { S.pairs.push([a, b]); updatePanel(); } };
})();

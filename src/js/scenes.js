'use strict';
// The eight storyboard scenes. Every function here is a pure function of time t (seconds).

const IMG = {};
const CX = W / 2, CY = H / 2;
const COOKIE_R = 0.451; // visible cookie radius as a fraction of the PNG's width

// ---------- shared backdrops ----------
const triPlum = new TriField(11, 70, ['#2b1433', '#341a3e', '#3e1f49', '#24102b', '#4a2456', '#2f1638'], { minS: 60, maxS: 340, alpha: [0.55, 1] });
const triBlue = new TriField(21, 60, ['#141a35', '#192143', '#1e2850', '#11162c', '#232e5c'], { minS: 50, maxS: 300, alpha: [0.5, 1] });
const triResult = new TriField(31, 60, ['#24122c', '#2c1736', '#351c42', '#1e0f25'], { minS: 60, maxS: 320, alpha: [0.5, 1] });
const triKiai = new TriField(41, 46, ['#1a1440', '#211a52', '#2a1c5c', '#151033', '#2b1650'], { minS: 80, maxS: 380, alpha: [0.35, 0.8] });

const travelMenu = travelFn(55, [[T(4), 2600, 2.2], [T(32), 900, 2]], [[T(4), T(8), 380, 9]]);
const travelBlue = travelFn(35, [[T(8), 900, 2.5], [T(16), 900, 2.5]]);
const travelKiai = travelFn(60, [[T(20), 2200, 2.4], [T(24), 1500, 2.4]], [[T(20), T(28), 420, 9]]);
const travelRes = travelFn(30, [[T(28), 1400, 2]]);

function fillGrad(ctx, top, bottom) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bottom);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function vignette(ctx, a = 0.55) {
  const g = ctx.createRadialGradient(CX, CY, H * 0.35, CX, CY, H * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}
function dotGrid(ctx, x0, y0, x1, y1, step, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  for (let y = y0; y <= y1; y += step) for (let x = x0; x <= x1; x += step) { ctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
  ctx.restore();
}

// official cookie PNG: only scaled and faded, never rotated or recoloured
function drawCookie(ctx, x, y, radius, alpha = 1) {
  if (alpha <= 0 || !IMG.cookie) return;
  const S = radius / COOKIE_R;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(IMG.cookie, x - S / 2, y - S / 2, S, S); ctx.restore();
}

// osu! main-menu style visualiser rays around the cookie
function visualiser(ctx, x, y, R, t, amp = 1, alpha = 0.35) {
  if (alpha <= 0) return;
  const N = 200, rot = t * 0.15;
  ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 7; ctx.globalAlpha *= alpha; ctx.lineCap = 'butt';
  ctx.beginPath();
  const p = 0.35 + 0.65 * pulse(t, 5);
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + rot;
    const n = noise1(i * 0.37 + t * 6.0) * noise1(i * 0.11 - t * 2.3 + 40);
    const L = (6 + Math.pow(n, 1.4) * 260 * p) * amp;
    ctx.moveTo(x + Math.cos(a) * (R + 4), y + Math.sin(a) * (R + 4));
    ctx.lineTo(x + Math.cos(a) * (R + 4 + L), y + Math.sin(a) * (R + 4 + L));
  }
  ctx.stroke(); ctx.restore();
}

// burst of triangles/confetti from a point
function burst(ctx, t, t0, x, y, seed, o = {}) {
  const { n = 60, dist: D = 700, life = 1.3, colors = ['#ffffff', PAL.pink, PAL.pinkLight, PAL.purpleLight], size = [10, 34] } = o;
  const dt = t - t0; if (dt < 0 || dt > life) return;
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, d = D * lerp(0.35, 1, r()), s = lerp(size[0], size[1], r()), c = colors[Math.floor(r() * colors.length)], spin = (r() - 0.5) * 10, lf = life * lerp(0.6, 1, r());
    const k = clamp(dt / lf); if (k >= 1) continue;
    const e = ease.outExpo(k);
    ctx.globalAlpha = (1 - ease.inQuad(k)) * 0.9;
    ctx.fillStyle = c; ctx.beginPath(); triPath(ctx, x + Math.cos(a) * d * e, y + Math.sin(a) * d * e + k * k * 120, s * (1 - k * 0.5), spin * dt); ctx.fill();
  }
  ctx.restore();
}

// leader-line callout pointing at a moving target
function callout(ctx, label, tx, ty, lx, ly, a, color = PAL.pink) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  const k = ease.outCubic(clamp(a));
  const mx = lerp(tx, lx, k), my = lerp(ty, ly, k);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(mx, my);
  const right = lx >= tx; ctx.lineTo(mx + (right ? 1 : -1) * 40 * k, my); ctx.stroke();
  disc(ctx, tx, ty, 6, '#fff'); disc(ctx, tx, ty, 11, '#fff', 0.25);
  text(ctx, label, mx + (right ? 52 : -52), my, { size: 26, weight: 700, spacing: 3, align: right ? 'left' : 'right', baseline: 'middle', color: '#fff' });
  disc(ctx, mx + (right ? 46 : -46), my, 0, color);
  ctx.restore();
}

// section title block: "01 / HIT CIRCLES / subtitle"
function sectionTitle(ctx, t, o) {
  const { x, y, num, title, lines, t0, tOut, align = 'left', color = PAL.pink } = o;
  kinetic(ctx, num, x, y, t, { size: 210, weight: 900, italic: true, align, color: null, stroke: color, strokeWidth: 4, t0, stagger: 0.06, dur: 0.45, tOut, mode: 'scale' });
  kinetic(ctx, title, x, y + 130, t, { size: 104, weight: 900, italic: true, align, color: '#fff', t0: t0 + 0.12, stagger: 0.028, dur: 0.4, tOut: tOut + 0.03 });
  const bw = tw(t, t0 + 0.25, t0 + 0.75, 0, 280, ease.outExpo) * (1 - ease.inCubic(inv(tOut, tOut + 0.3, t)));
  if (bw > 0) { ctx.fillStyle = color; ctx.fillRect(align === 'right' ? x - bw : x, y + 162, bw, 9); }
  lines.forEach((ln, i) => kinetic(ctx, ln, x, y + 232 + i * 52, t, { size: 40, weight: 500, italic: false, align, color: '#d9d2f2', t0: t0 + 0.4 + i * 0.1, stagger: 0.008, dur: 0.3, tOut: tOut + 0.06 + i * 0.03, rise: 0.4 }));
}

// ---------- scene 0: intro ----------
const introTimes = [T(2, 0), T(2, 1), T(2, 2), T(2, 3), T(3, 0), T(3, 1), T(3, 2), T(3, 2.5), T(3, 3), T(3, 3.25), T(3, 3.5)];
const introMap = new Beatmap({ r: 64, preempt: 0.75, judge: false, seed: 5, vol: 0.9 });
introTimes.forEach((tt, i) => {
  const a = -PI / 2 + i * 2.39996, rr = lerp(330, 150, i / 10);
  introMap.circle(tt, CX + Math.cos(a) * rr * 1.25, CY + Math.sin(a) * rr, { nc: i === 0 || i === 4 || i === 8, sound: i % 4 === 0 ? 'clap' : 'normal' });
});
introMap.finalize();
const introCursor = introMap.cursor(new CursorPath()).point(T(1, 3), CX, H + 60).point(T(4, 0), CX, CY).click(T(4, 0)).done();
const WELCOME = 'welcome to osu!';
for (let i = 0; i < WELCOME.length; i++) if (WELCOME[i] !== ' ') cue(T(1, i * 0.25), 'type', { pan: panOf(CX - 160 + i * 22) });
cue(T(4), 'hit', { s: 'finish', pan: 0, vol: 1 });
cue(T(4), 'impact');

function sIntro(ctx, t) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const build = inv(T(3), T(4), t);
  if (build > 0) {
    const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, H * 0.9);
    g.addColorStop(0, rgba(PAL.purpleDarker, 0.55 * build)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // warp streaks converging on the centre
    const r = rng(99);
    ctx.save(); ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const a = r() * TAU, sp = lerp(0.6, 1.6, r()), ph = r();
      const k = ((t * sp + ph) % 1);
      const R0 = lerp(1300, 200, k), R1 = R0 + lerp(80, 260, r()) * (1 - k);
      ctx.globalAlpha = build * 0.35 * Math.sin(k * PI); ctx.lineWidth = 2 + 2 * r();
      ctx.beginPath(); ctx.moveTo(CX + Math.cos(a) * R0, CY + Math.sin(a) * R0); ctx.lineTo(CX + Math.cos(a) * R1, CY + Math.sin(a) * R1); ctx.stroke();
    }
    ctx.restore();
  }
  // giant beat words
  const words = ['click', 'to', 'the', 'beat'];
  words.forEach((w, i) => {
    const t0 = T(2, i), a = win(t, t0, t0 + 0.05, t0 + 0.22, t0 + 0.37, ease.linear, ease.inQuad);
    if (a <= 0) return;
    ctx.save(); ctx.translate(CX, CY + 20); const s = lerp(1.15, 1, ease.outCubic(inv(t0, t0 + 0.37, t))); ctx.scale(s, s);
    text(ctx, w, 0, 0, { size: 340, weight: 900, italic: true, align: 'center', baseline: 'middle', color: 'rgba(255,255,255,0.10)', alpha: a, stroke: 'rgba(255,255,255,0.35)', strokeWidth: 3 });
    ctx.restore();
  });
  // lazer-intro homage: triangle + typed "welcome to osu!"
  const ta = win(t, 0.25, 0.7, T(2) - 0.15, T(2) + 0.15);
  if (ta > 0) {
    ctx.save(); ctx.translate(CX, CY - 50);
    const s = ease.outBack(inv(0.25, 0.7, t)) * (1 + 0.6 * ease.inCubic(inv(T(2) - 0.15, T(2) + 0.15, t)));
    ctx.scale(s, s); ctx.globalAlpha = ta;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); triPath(ctx, 0, 0, 64, 0); ctx.stroke();
    ctx.globalAlpha = ta * (0.4 + 0.6 * pulse(Math.max(0, t - 0.25), 4)); ctx.fillStyle = '#fff';
    ctx.beginPath(); triPath(ctx, 0, 0, 30, 0); ctx.fill();
    ctx.restore();
    const n = Math.floor(clamp((t - T(1)) / (BEAT / 4), 0, WELCOME.length));
    const shown = WELCOME.slice(0, n);
    const caret = t > T(1) - 0.5 && (Math.floor(t * 4) % 2 === 0 || (n > 0 && n < WELCOME.length));
    const full = measure(ctx, WELCOME, 46, 400, false, 7);
    text(ctx, shown, CX - full / 2, CY + 46, { size: 46, weight: 400, spacing: 7, color: '#fff', alpha: ta });
    if (caret) { const cw = measure(ctx, shown, 46, 400, false, 7); ctx.fillStyle = `rgba(255,255,255,${0.8 * ta})`; ctx.fillRect(CX - full / 2 + cw + 2, CY + 10, 3, 44); }
  }
  // the last approach circle: closes onto where the cookie will appear
  if (t >= T(3) - 0.2) {
    const k = inv(T(3) - 0.2, T(4), t);
    ring(ctx, CX, CY, lerp(1150, 282, k), lerp(4, 12, k), '#ffffff', ease.inQuad(k) * 0.9);
  }
  const shake = build * build * 7;
  ctx.save(); ctx.translate((noise1(t * 30) - 0.5) * shake, (noise1(t * 30 + 9) - 0.5) * shake);
  introMap.draw(ctx, t);
  ctx.restore();
  drawCursor(ctx, introCursor, t, { alpha: inv(T(1, 3), T(2) - 0.4, t) });
}

// ---------- scene 1: cookie + main menu ----------
const MENU = [
  { label: 'Play', w: 1560, icon: 'play' }, { label: 'Edit', w: 1580, icon: 'edit' },
  { label: 'Options', w: 1580, icon: 'options' }, { label: 'Exit', w: 1560, icon: 'exit' },
];
const menuCursor = new CursorPath().point(T(6, 1), 1760, 1000).point(T(7, 0) - 0.05, 1260, 372).seg(T(7, 0) - 0.05, T(7, 2), t => ({ x: 1260 + Math.sin((t - T(7)) * 9) * 6, y: 372 + Math.cos((t - T(7)) * 7) * 4 })).point(T(8), 1200, 380).click(T(7, 2)).done();
const menuCookieX = t => tw(t, T(6), T(6, 1.2), CX, 610, ease.inOutCubic);
const menuCookieR = t => tw(t, T(6), T(6, 1.2), 282, 238, ease.inOutCubic);
cue(T(6, 1), 'whoosh', { dur: 0.5, pan: 0.2 });
cue(T(7, 0), 'hover', { pan: 0.3 });
cue(T(7, 2), 'click', { pan: 0.3 });
cue(T(7, 2.5), 'whoosh', { dur: 0.6, pan: 0.2 });

function menuIcon(ctx, kind, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = '#fff'; ctx.fillStyle = '#fff'; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (kind === 'play') {
    ring(ctx, -s * 0.3, s * 0.12, s * 0.38, 4, '#fff'); ring(ctx, s * 0.32, -s * 0.18, s * 0.38, 4, '#fff');
    text(ctx, '1', -s * 0.3, s * 0.14, { size: s * 0.45, weight: 800, align: 'center', baseline: 'middle' });
    text(ctx, '2', s * 0.32, -s * 0.16, { size: s * 0.45, weight: 800, align: 'center', baseline: 'middle' });
  } else if (kind === 'edit') {
    ctx.rotate(-PI / 4); ctx.strokeRect(-s * 0.55, -s * 0.15, s * 0.95, s * 0.3);
    ctx.beginPath(); ctx.moveTo(s * 0.4, -s * 0.15); ctx.lineTo(s * 0.65, 0); ctx.lineTo(s * 0.4, s * 0.15); ctx.stroke();
  } else if (kind === 'options') {
    for (let i = 0; i < 3; i++) {
      const yy = (i - 1) * s * 0.32; ctx.beginPath(); ctx.moveTo(-s * 0.5, yy); ctx.lineTo(s * 0.5, yy); ctx.stroke();
      disc(ctx, [-0.2, 0.25, -0.05][i] * s, yy, s * 0.1, '#fff');
    }
  } else if (kind === 'exit') {
    ctx.strokeRect(-s * 0.3, -s * 0.5, s * 0.6, s); disc(ctx, s * 0.15, 0, s * 0.06, '#fff');
  }
  ctx.restore();
}

function sMenu(ctx, t) {
  fillGrad(ctx, '#1d0f24', '#120916');
  triPlum.draw(ctx, travelMenu(t), 1);
  const kiaiFlash = t >= T(4) && t < T(8) ? pulse(t, 7) * 0.06 : 0;
  if (kiaiFlash > 0) { ctx.fillStyle = `rgba(255,102,170,${kiaiFlash})`; ctx.fillRect(0, 0, W, H); }
  const x = menuCookieX(t), R0 = menuCookieR(t);
  // menu buttons sit behind the cookie
  const hover = inv(T(7) - 0.12, T(7) + 0.05, t), clickF = flashAt(t, T(7, 2), 7);
  MENU.forEach((b, i) => {
    const t0 = T(6, 1) + i * 0.07;
    const k = ease.outCubic(inv(t0, t0 + 0.42, t));
    if (k <= 0) return;
    const y = CY + (i - 1.5) * 128, h = 108, skew = 0.2;
    const isPlay = i === 0;
    const right = lerp(x, b.w + (isPlay ? 50 * ease.outBack(hover) : 0), k);
    const left = x;
    ctx.save();
    const base = isPlay ? mix(PAL.purple, '#B59BFF', hover * 0.6) : mix(PAL.purple, '#5a4b8a', hover * 0.35);
    const g = ctx.createLinearGradient(0, y - h / 2, 0, y + h / 2);
    g.addColorStop(0, rgba(lighten(base, 0.12))); g.addColorStop(1, rgba(darken(base, 0.12)));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(left, y - h / 2); ctx.lineTo(right + h * skew / 2, y - h / 2); ctx.lineTo(right - h * skew / 2, y + h / 2); ctx.lineTo(left, y + h / 2); ctx.closePath(); ctx.fill();
    if (isPlay && clickF > 0) { ctx.fillStyle = `rgba(255,255,255,${clickF * 0.8})`; ctx.fill(); }
    if (isPlay && hover > 0) { ctx.strokeStyle = `rgba(255,255,255,${0.6 * hover})`; ctx.lineWidth = 3; ctx.stroke(); }
    ctx.save(); ctx.clip();
    text(ctx, b.label, x + R0 + 90, y + 4, { size: 62, weight: 600, italic: true, baseline: 'middle', color: '#fff', alpha: k });
    menuIcon(ctx, b.icon, right - 110, y, 64);
    ctx.restore();
    ctx.restore();
  });
  // ripples + visualiser + cookie
  const pr = 1 + 0.035 * (t >= T(4) ? pulse(t, 7) : 0) + 0.05 * clickF;
  const enter = ease.outBack(inv(T(4), T(4) + 0.35, t));
  const R = R0 * lerp(0.92, 1, enter) * pr;
  visualiser(ctx, x, CY, R * 0.98, t, 1, 0.3 * inv(T(4), T(4) + 0.4, t));
  for (let b = beatIndex(T(4)); b <= beatIndex(t); b++) {
    const dt = t - b * BEAT; if (dt < 0 || dt > 0.7 || b * BEAT >= T(8)) continue;
    ring(ctx, x, CY, R * lerp(1, 1.5, ease.outCubic(dt / 0.7)), 4, '#ffffff', (1 - dt / 0.7) * 0.35);
  }
  burst(ctx, t, T(4), CX, CY, 7, { n: 70, dist: 900 });
  drawCookie(ctx, x, CY, R, inv(T(4) - 0.02, T(4) + 0.08, t));
  // tagline
  const words = [['rhythm', '#fff'], ['is just', '#fff'], ['a click', PAL.pink], ['away', '#fff']];
  const total = words.reduce((s, w) => s + measure(ctx, w[0] + '  ', 70, 800, true), 0);
  let wx = CX - total / 2;
  words.forEach(([w, c], i) => {
    const t0 = T(5, i), k = inv(t0, t0 + 0.25, t), out = inv(T(6), T(6) + 0.25, t);
    const ww = measure(ctx, w + '  ', 70, 800, true);
    if (k > 0 && out < 1) {
      ctx.save(); ctx.translate(wx + ww / 2, 960); const s = lerp(1.6, 1, ease.outBack(k)); ctx.scale(s, s);
      text(ctx, w, 0, 0, { size: 70, weight: 800, italic: true, align: 'center', baseline: 'middle', color: c, alpha: clamp(k * 2) * (1 - out) });
      ctx.restore();
    }
    wx += ww;
  });
  drawCursor(ctx, menuCursor, t, { alpha: inv(T(6, 1), T(6, 1.6), t) });
}

// ---------- scene 2: hit circles ----------
const circleMap = new Beatmap({ r: 80, preempt: 0.75, seed: 9 });
[
  [T(9, 0), 1180, 330, 1], [T(9, 1), 1490, 270], [T(9, 2), 1650, 520], [T(9, 3), 1420, 700],
  [T(10, 0), 1110, 640, 1], [T(10, 1), 1240, 870], [T(10, 2), 1540, 880], [T(10, 3), 1720, 760],
  [T(11, 0), 1560, 440, 1], [T(11, 1), 1270, 470], [T(11, 2), 1380, 230], [T(11, 3), 1680, 220],
].forEach(([tt, x, y, nc], i) => circleMap.circle(tt, x, y, { nc: !!nc, sound: i % 4 === 2 ? 'clap' : i % 4 === 0 ? 'whistle' : 'normal' }));
circleMap.finalize();
const circleCursor = circleMap.cursor(new CursorPath()).point(T(8, 1), 900, 1150).point(T(12, 1), 1900, 120).done();
cue(T(11, 3), 'whoosh', { dur: 0.5, pan: 0.6 });

function bgBlue(ctx, t) {
  fillGrad(ctx, '#11142a', '#090a16');
  triBlue.draw(ctx, travelBlue(t), 0.9);
}

function sCircles(ctx, t) {
  bgBlue(ctx, t);
  dotGrid(ctx, 1000, 160, 1840, 940, 40, 0.07 * inv(T(8), T(8, 2), t));
  sectionTitle(ctx, t, { x: 150, y: 330, num: '01', title: 'HIT CIRCLES', lines: ['Click each circle the moment', 'its approach circle closes in.'], t0: T(8) + 0.05, tOut: T(11, 3) });
  // judgement chips
  const chips = [['300', JUDGE[300]], ['100', JUDGE[100]], ['50', JUDGE[50]], ['✕', JUDGE[0]]];
  chips.forEach(([s, c], i) => {
    const t0 = T(9, 2) + i * 0.08, k = ease.outBack(inv(t0, t0 + 0.3, t)), out = inv(T(11, 3) + i * 0.03, T(11, 3) + 0.25 + i * 0.03, t);
    if (k <= 0 || out >= 1) return;
    const x = 150 + i * 132, y = 760;
    ctx.save(); ctx.globalAlpha = clamp(k) * (1 - out); ctx.translate(x + 56, y); ctx.scale(k, k);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.strokeStyle = rgba(c, 0.8); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-56, -34, 112, 68, 34); ctx.fill(); ctx.stroke();
    text(ctx, s, 0, 3, { size: 36, weight: 700, align: 'center', baseline: 'middle', color: rgba(lighten(c, 0.3)), shadow: { color: rgba(c, 0.8), blur: 12 } });
    ctx.restore();
  });
  text(ctx, 'TIMING  →  SCORE', 150, 840, { size: 22, weight: 700, spacing: 4, color: '#8f88b3', alpha: win(t, T(9, 3), T(10), T(11, 3), T(12)) });
  circleMap.draw(ctx, t);
  // callouts on the first circle
  const o = circleMap.objs[0];
  const ca = win(t, T(8, 2.2), T(8, 3), T(9) - 0.08, T(9) + 0.1);
  if (ca > 0) {
    const kk = inv(o.t - circleMap.preempt, o.t, t), rr = circleMap.r * lerp(4, 1, kk) * 0.92;
    const ax = o.x + Math.cos(-2.4) * rr, ay = o.y + Math.sin(-2.4) * rr;
    callout(ctx, 'APPROACH CIRCLE', ax, ay, ax - 90, ay - 70, ca);
    callout(ctx, 'HIT CIRCLE', o.x + 50, o.y + 52, o.x + 200, o.y + 170, ca);
  }
  drawCursor(ctx, circleCursor, t, { alpha: inv(T(8, 1.5), T(8, 3), t) });
}

// ---------- scene 3: sliders ----------
const sliderMap = new Beatmap({ r: 80, preempt: 0.75, seed: 13, colorStart: 3 });
sliderMap.slider(T(13, 0), [{ x: 230, y: 470 }, { x: 420, y: 270 }, { x: 640, y: 450 }, { x: 860, y: 300 }], { span: 2 * BEAT, repeats: 1, nc: true, sound: 'whistle' });
sliderMap.slider(T(14, 1), [{ x: 330, y: 860 }, { x: 560, y: 690 }, { x: 820, y: 820 }], { span: 2 * BEAT, curve: 'arc', nc: true });
sliderMap.circle(T(15, 0), 900, 590, { sound: 'clap' });
sliderMap.slider(T(15, 1), [{ x: 650, y: 560 }, { x: 420, y: 640 }], { span: BEAT, curve: 'linear', nc: true });
sliderMap.circle(T(15, 3), 230, 760, { sound: 'clap' });
sliderMap.finalize();
const sliderCursor = sliderMap.cursor(new CursorPath()).point(T(12, 1), -80, 300).point(T(16, 0.5), 960, 540).done();
cue(T(15, 3), 'whoosh', { dur: 0.6, pan: 0 });

function sSliders(ctx, t) {
  bgBlue(ctx, t);
  dotGrid(ctx, 100, 160, 960, 940, 40, 0.07 * inv(T(12), T(12, 2), t));
  sectionTitle(ctx, t, { x: 1780, y: 330, num: '02', title: 'SLIDERS', lines: ['Hold the button and follow', 'the ball along the track.'], t0: T(12) + 0.05, tOut: T(15, 3), align: 'right', color: PAL.blue });
  sliderMap.draw(ctx, t);
  const s = sliderMap.objs[0];
  const ca = win(t, T(13, 0.2), T(13, 0.7), T(13, 3.2), T(13, 3.7));
  if (ca > 0) {
    const b = sliderMap.ballAt(s, t);
    callout(ctx, 'SLIDER BALL', b.x + 22, b.y + 30, 600, 650, ca, PAL.blue);
    callout(ctx, 'FOLLOW CIRCLE', b.x + 100, b.y - 125, 560, 110, ca, PAL.blue);
    const e = s.path.at(s.path.len);
    if (t < T(13, 2)) callout(ctx, 'REVERSE ARROW', e.x + 20, e.y - 30, e.x + 120, e.y - 170, ca * (1 - inv(T(13, 1.7), T(13, 2), t)), PAL.blue);
  }
  const ta = win(t, T(12, 2.5), T(12, 3.2), T(13) + 0.1, T(13, 0.5));
  if (ta > 0) { const p = s.path.at(s.path.len * 0.62); callout(ctx, 'SLIDER TRACK', p.x, p.y + 60, p.x + 70, p.y + 200, ta, PAL.blue); }
  drawCursor(ctx, sliderCursor, t, { alpha: inv(T(12, 1.5), T(12, 3), t) });
}

// ---------- scene 4: spinner + countdown ----------
const SPX = 1200, SPY = 500;
const spinMap = new Beatmap({ r: 80, preempt: 0.75, seed: 17 });
spinMap.spinner(T(16, 2), T(18, 2), SPX, SPY, 290, { need: 14, ramp: 0.7 });
spinMap.finalize();
const spinCursor = spinMap.cursor(new CursorPath()).point(T(16, 0), 960, 540).point(T(19, 3.5), CX, CY + 40).done();
['3', '2', '1', 'GO!'].forEach((s, i) => cue(T(19, i), 'count', { n: 3 - i }));
cue(T(18, 2.5), 'whoosh', { dur: 0.5, pan: -0.4 });

function sSpinner(ctx, t) {
  bgBlue(ctx, t);
  const g = ctx.createRadialGradient(SPX, SPY, 0, SPX, SPY, 800);
  g.addColorStop(0, rgba(PAL.purpleDark, 0.25 * inv(T(16), T(16, 2), t) * (1 - inv(T(18, 2), T(19), t)))); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  sectionTitle(ctx, t, { x: 130, y: 300, num: '03', title: 'SPINNERS', lines: ['Spin the cursor until', 'the meter fills up.'], t0: T(16) + 0.05, tOut: T(18, 2), color: PAL.yellow });
  spinMap.draw(ctx, t);
  // READY? + countdown
  const ra = win(t, T(18, 2.6), T(18, 3), T(19) - 0.06, T(19) + 0.05);
  if (ra > 0) text(ctx, 'READY?', CX, CY + 20, { size: 150, weight: 900, italic: true, align: 'center', baseline: 'middle', color: '#fff', alpha: ra, spacing: 8 });
  ['3', '2', '1', 'GO!'].forEach((s, i) => {
    const t0 = T(19, i), dt = t - t0;
    if (dt < 0 || dt > BEAT + (i === 3 ? 0.1 : 0)) return;
    const k = ease.outBack(inv(0, 0.18, dt)), out = inv(BEAT * 0.6, BEAT + (i === 3 ? 0.1 : 0), dt);
    const col = [PAL.pink, PAL.purpleLight, PAL.blue, PAL.yellow][i];
    ring(ctx, CX, CY + 20, lerp(120, 330, ease.outCubic(inv(0, BEAT, dt))), 10 * (1 - out), col, 0.8 * (1 - out));
    glow(ctx, CX, CY + 20, 380, col, 0.25 * (1 - out));
    ctx.save(); ctx.translate(CX, CY + 20); ctx.scale(lerp(2.2, 1, k) * (1 + 0.15 * out), lerp(2.2, 1, k) * (1 + 0.15 * out));
    text(ctx, s, 0, 8, { size: i === 3 ? 230 : 280, weight: 900, italic: true, align: 'center', baseline: 'middle', color: '#fff', alpha: clamp(inv(0, 0.06, dt)) * (1 - out), shadow: { color: rgba(col, 0.9), blur: 40 } });
    ctx.restore();
  });
  drawCursor(ctx, spinCursor, t, { alpha: inv(T(16), T(16, 1), t) * (1 - inv(T(18, 3), T(19), t)) });
}

// ---------- scene 5: kiai gameplay ----------
const PF = { s: 2.1, ox: (W - 512 * 2.1) / 2, oy: (H - 384 * 2.1) / 2 + 22 };
const P = (x, y) => ({ x: PF.ox + x * PF.s, y: PF.oy + y * PF.s });
const kiai = new Beatmap({ r: 76, preempt: 0.6, fadeIn: 0.4, seed: 23, vol: 0.85, judgeGap: 0.15 });
(function buildKiai() {
  const hs = (bt) => (Math.abs(bt % 1) < 1e-6 && Math.round(bt) % 2 === 1 ? 'clap' : 'normal');
  const add = (bar, beat, x, y, nc) => { const p = P(x, y); kiai.circle(T(bar, beat), p.x, p.y, { nc, sound: hs(beat) }); };
  // bars 20-21: 1/2 triangle jumps, slowly rotating
  for (let i = 0; i < 16; i++) {
    const a = -PI / 2 + i * (TAU / 3) + i * 0.16, rr = 150;
    add(20 + Math.floor(i / 8), (i % 8) * 0.5, 256 + Math.cos(a) * rr * 1.25, 192 + Math.sin(a) * rr, i % 4 === 0);
  }
  // bar 22: 1/4 S-curve stream
  for (let i = 0; i < 16; i++) { const k = i / 15; add(22, i * 0.25, lerp(50, 460, k), 200 + Math.sin(k * TAU) * 120, i === 0); }
  // bar 23: kick sliders then a 1/2 burst
  const s1 = [P(440, 300), P(330, 360), P(220, 300)], s2 = [P(110, 170), P(200, 80), P(320, 110)];
  kiai.slider(T(23, 0), s1, { span: BEAT, curve: 'arc', nc: true, sound: 'whistle' });
  kiai.slider(T(23, 1), s2, { span: BEAT, curve: 'arc', sound: 'clap' });
  [[420, 230], [300, 300], [180, 240], [256, 140]].forEach(([x, y], i) => add(23, 2 + i * 0.5, x, y, i === 0));
  // bars 24-25: pentagram jumps
  for (let i = 0; i < 16; i++) {
    const a = -PI / 2 + ((i * 2) % 5) * (TAU / 5) + Math.floor(i / 5) * 0.35, rr = 165;
    add(24 + Math.floor(i / 8), (i % 8) * 0.5, 256 + Math.cos(a) * rr * 1.2, 196 + Math.sin(a) * rr, i % 5 === 0);
  }
  // bar 26: 1/4 spiral stream
  for (let i = 0; i < 16; i++) { const k = i / 15, a = k * TAU * 1.3, rr = lerp(175, 55, k); add(26, i * 0.25, 256 + Math.cos(a) * rr * 1.25, 192 + Math.sin(a) * rr, i === 0); }
  // bar 27: wide jumps, then a burst into the centre
  [[60, 60], [450, 330], [450, 60], [60, 330]].forEach(([x, y], i) => add(27, i * 0.5, x, y, i === 0));
  for (let i = 0; i < 8; i++) { const k = i / 7, a = PI + k * PI * 1.1; add(27, 2 + i * 0.25, 256 + Math.cos(a) * lerp(190, 70, k), 192 + Math.sin(a) * lerp(140, 50, k), i === 0); }
  const c = P(256, 192); kiai.circle(T(28), c.x, c.y, { nc: true, sound: 'finish' });
})();
kiai.finalize();
const kiaiCursor = kiai.cursor(new CursorPath()).point(T(19, 3.6), CX, CY + 40).point(T(28, 1.5), CX + 30, CY + 90).done();
cue(T(20), 'hit', { s: 'finish', pan: 0, vol: 0.8 });
cue(T(24), 'hit', { s: 'finish', pan: 0, vol: 0.8 });

// score v1-ish accumulation for the HUD
const SCORE_AT = (() => {
  let sc = 0; const pts = [];
  for (const e of kiai.events) {
    const v = e.kind === 'tick' ? 10 : e.kind === 'repeat' ? 30 : 300;
    sc += v + (e.kind === 'tick' || e.kind === 'repeat' ? 0 : Math.floor((v * Math.max(0, e.combo - 1) * 4) / 25));
    pts.push([e.t, sc]);
  }
  return t => { let s = 0; for (const [tt, v] of pts) { if (tt <= t) s = v; else break; } return s; };
})();
const FINAL_SCORE = SCORE_AT(1e9) * 10;
const MAX_COMBO = kiai.events.length;
const N300 = kiai.objs.length;

const KIAI_WORDS = [[T(20), 'AIM'], [T(22), 'SPEED'], [T(23), 'FLOW'], [T(24), 'AIM'], [T(26), 'STAMINA'], [T(27), 'FOCUS']];

function fountain(ctx, t, t0, seed) {
  const dt = t - t0; if (dt < 0 || dt > 2.2) return;
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let side = 0; side < 2; side++) for (let i = 0; i < 45; i++) {
    const delay = r() * 0.5, life = lerp(1.1, 1.6, r()), vx = lerp(150, 520, r()) * (side ? -1 : 1), vy = -lerp(900, 1500, r());
    const tt = dt - delay; if (tt < 0 || tt > life) continue;
    const x = (side ? W + 20 : -20) + vx * tt, y = H + 20 + vy * tt + 0.5 * 1300 * tt * tt;
    const a = 1 - tt / life, s = lerp(5, 11, r());
    glow(ctx, x, y, s * 4, i % 3 ? '#ffffff' : PAL.pink, a * 0.55);
    ctx.globalAlpha = a; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, s * 0.5, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function digits(ctx, str, x, y, size, o = {}) { // fixed-width digits so counters don't jitter
  const { align = 'right', color = '#fff', weight = 600, italic = false, cell = size * 0.6, alpha = 1 } = o;
  const cwOf = ch => (/[0-9]/.test(ch) ? cell : ch === '%' ? cell * 1.3 : cell * 0.45);
  const w = [...str].reduce((s, ch) => s + cwOf(ch), 0);
  let x0 = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
  for (const ch of str) {
    const cw = cwOf(ch);
    text(ctx, ch, x0 + cw / 2, y, { size, weight, italic, align: 'center', baseline: 'alphabetic', color, alpha });
    x0 += cw;
  }
}

function hud(ctx, t, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha = a;
  const combo = kiai.comboAt(t), last = kiai.lastEventBefore(t);
  // HP bar
  const hp = clamp(0.62 + 0.38 * (1 - Math.exp(-combo / 12)) - 0.03 * noise1(t * 0.7));
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.roundRect(28, 26, 640, 18, 9); ctx.fill();
  const hg = ctx.createLinearGradient(28, 0, 668, 0); hg.addColorStop(0, '#ffffff'); hg.addColorStop(1, PAL.pinkLight);
  ctx.fillStyle = hg; ctx.beginPath(); ctx.roundRect(30, 28, 636 * hp, 14, 7); ctx.fill();
  glow(ctx, 30 + 636 * hp, 35, 40, PAL.pink, 0.6 + 0.4 * pulse(t, 8));
  disc(ctx, 30 + 636 * hp, 35, 9, '#fff');
  // score + accuracy + progress pie
  const sc = String(Math.round(SCORE_AT(t) * 10)).padStart(8, '0');
  digits(ctx, sc, W - 34, 92, 76, { weight: 500 });
  digits(ctx, '100.00%', W - 34, 148, 40, { weight: 500, cell: 24 });
  const prog = inv(T(20), T(28), t);
  const px = W - 34 - 7.3 * 24 - 34, py = 134;
  disc(ctx, px, py, 17, 'rgba(255,255,255,0.15)');
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, 17, -PI / 2, -PI / 2 + TAU * prog); ctx.closePath(); ctx.fill();
  ring(ctx, px, py, 17, 2, '#fff', 0.9);
  // combo counter with pop + ghost
  const sinceInc = last ? t - last.t : 9;
  const pop = 1 + 0.18 * (1 - ease.outCubic(inv(0, 0.14, sinceInc)));
  ctx.save(); ctx.translate(30, H - 30); ctx.scale(pop, pop);
  text(ctx, combo + 'x', 0, 0, { size: 104, weight: 600, color: '#fff' });
  ctx.restore();
  if (sinceInc < 0.35) { ctx.save(); ctx.translate(30, H - 30); const g2 = 1 + 0.5 * inv(0, 0.35, sinceInc); ctx.scale(g2, g2); text(ctx, combo + 'x', 0, 0, { size: 104, weight: 600, color: '#fff', alpha: 0.35 * (1 - inv(0, 0.35, sinceInc)) }); ctx.restore(); }
  // hit error meter
  const mx = CX, my = H - 28, mw = 360;
  const zones = [[1, JUDGE[50]], [0.62, JUDGE[100]], [0.3, JUDGE[300]]];
  for (const [f, c] of zones) { ctx.fillStyle = rgba(c, 0.85); ctx.fillRect(mx - (mw / 2) * f, my - 3, mw * f, 6); }
  ctx.fillStyle = '#fff'; ctx.fillRect(mx - 1.5, my - 16, 3, 32);
  for (const h of kiai.hits) {
    const dt = t - h.t; if (dt < 0 || dt > 2.5) continue;
    const ex = mx + (h.o.err / 0.08) * (mw / 2);
    ctx.fillStyle = rgba(JUDGE[300], 0.9 * (1 - dt / 2.5)); ctx.fillRect(ex - 1.5, my - 13, 3, 26);
  }
  // key overlay
  ['K1', 'K2'].forEach((k, i) => {
    const pressed = kiai.hits.some(h => h.key === i && t >= h.t && t <= h.t + h.dur);
    const count = kiai.hits.filter(h => h.key === i && h.t <= t).length;
    const bx = W - 92, by = CY - 70 + i * 82, s = pressed ? 0.9 : 1;
    ctx.save(); ctx.translate(bx + 34, by + 34); ctx.scale(s, s);
    ctx.fillStyle = pressed ? 'rgba(255,204,34,0.95)' : 'rgba(255,255,255,0.12)'; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-34, -34, 68, 68, 10); ctx.fill(); ctx.stroke();
    text(ctx, count ? String(count) : k, 0, 2, { size: count > 99 ? 22 : 26, weight: 700, align: 'center', baseline: 'middle', color: pressed ? '#2a1a00' : '#fff' });
    ctx.restore();
  });
  ctx.restore();
}

function sKiai(ctx, t) {
  fillGrad(ctx, '#140f2e', '#08060f');
  // big drifting colour blobs (stand-in for a dimmed beatmap background)
  glow(ctx, 420 + Math.sin(t * 0.4) * 120, 300 + Math.cos(t * 0.3) * 80, 900, '#3a1650', 0.55);
  glow(ctx, 1500 + Math.cos(t * 0.35) * 140, 820 + Math.sin(t * 0.5) * 70, 900, '#122a5a', 0.55);
  triKiai.draw(ctx, travelKiai(t), 0.75);
  const fl = (t >= T(20) && t < T(28)) ? pulse(t, 9) * 0.05 + (sinceBeat(t) < 0.2 && beatIndex(t) % 4 === 0 ? 0.04 * (1 - sinceBeat(t) / 0.2) : 0) : 0;
  if (fl > 0) { ctx.fillStyle = `rgba(190,170,255,${fl})`; ctx.fillRect(0, 0, W, H); }
  // background skill words
  for (let i = 0; i < KIAI_WORDS.length; i++) {
    const [t0, w] = KIAI_WORDS[i], t1 = i + 1 < KIAI_WORDS.length ? KIAI_WORDS[i + 1][0] : T(28);
    const a = win(t, t0, t0 + 0.12, t1 - 0.15, t1);
    if (a <= 0) continue;
    ctx.save(); ctx.translate(CX + (t - t0) * -40, CY + 10); const s = lerp(1.25, 1, ease.outExpo(inv(t0, t0 + 0.4, t))); ctx.scale(s, s);
    text(ctx, w, 0, 0, { size: 420, weight: 900, italic: true, align: 'center', baseline: 'middle', color: 'rgba(255,255,255,0.045)', alpha: a, stroke: 'rgba(255,255,255,0.13)', strokeWidth: 3, spacing: 10 });
    ctx.restore();
  }
  fountain(ctx, t, T(20), 3); fountain(ctx, t, T(24), 4);
  // camera punch on every beat
  const punch = 1 + (t >= T(20) && t < T(28) ? 0.01 * pulse(t, 10) + (beatIndex(t) % 4 === 0 ? 0.008 * pulse(t, 8) : 0) : 0);
  ctx.save(); ctx.translate(CX, CY); ctx.scale(punch, punch); ctx.translate(-CX, -CY);
  // playfield frame hint
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2; ctx.strokeRect(PF.ox - 76, PF.oy - 76, 512 * PF.s + 152, 384 * PF.s + 152);
  kiai.draw(ctx, t);
  drawCursor(ctx, kiaiCursor, t, { alpha: 1 });
  ctx.restore();
  hud(ctx, t, inv(T(19, 3), T(20), t) * (1 - inv(T(28), T(28, 0.4), t)));
}

// ---------- scene 6: results ----------
const GRADE_SEG = [[0, '#FF5E8A'], [0.7, '#B78CF7'], [0.8, '#66CCFF'], [0.9, '#88DA20'], [0.95, '#FFCC22'], [1, '#FFE680']];
cue(T(28, 1), 'tickup', { dur: +(T(29) - T(28, 1)).toFixed(4) });
cue(T(29), 'slam');
cue(T(29, 0.5), 'whoosh', { dur: 0.5, pan: 0.5 });
cue(T(31, 2.5), 'whoosh', { dur: 0.6, pan: 0 });

function sResults(ctx, t) {
  fillGrad(ctx, '#1c0f22', '#0d0710');
  triResult.draw(ctx, travelRes(t), 0.9);
  const out = ease.inCubic(inv(T(31, 2), T(32), t));
  ctx.save(); ctx.globalAlpha = 1 - out;
  // header
  const ha = ease.outCubic(inv(T(28) + 0.05, T(28, 1), t));
  ctx.save(); ctx.translate(0, (1 - ha) * -80);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, 112);
  text(ctx, 'click the circles', 60, 58, { size: 46, weight: 700, color: '#fff' });
  text(ctx, 'original soundtrack  ·  160 BPM  ·  [Kiai]', 60, 94, { size: 24, weight: 500, color: '#c7bfe0', spacing: 1 });
  text(ctx, '★ 6.27', W - 60, 72, { size: 44, weight: 700, align: 'right', color: PAL.yellow });
  ctx.restore();
  // accuracy ring
  const rx = 600, ry = 590, RR = 250;
  const fill = ease.inOutCubic(inv(T(28, 1), T(29), t));
  const ra = ease.outBack(inv(T(28, 0.3), T(28, 1.2), t));
  ctx.save(); ctx.translate(rx, ry); ctx.scale(ra, ra); ctx.translate(-rx, -ry);
  ring(ctx, rx, ry, RR, 44, 'rgba(255,255,255,0.08)');
  for (let i = 0; i < GRADE_SEG.length - 1; i++) {
    const a0 = GRADE_SEG[i][0], a1 = Math.min(GRADE_SEG[i + 1][0], fill);
    if (a1 <= a0) continue;
    ctx.strokeStyle = GRADE_SEG[i][1]; ctx.lineWidth = 44;
    ctx.beginPath(); ctx.arc(rx, ry, RR, -PI / 2 + a0 * TAU, -PI / 2 + a1 * TAU); ctx.stroke();
  }
  if (fill >= 1) { ctx.strokeStyle = '#FFE680'; ctx.lineWidth = 44; ctx.beginPath(); ctx.arc(rx, ry, RR, -PI / 2 + 0.995 * TAU, -PI / 2 + TAU); ctx.stroke(); }
  ring(ctx, rx, ry, RR - 34, 3, '#ffffff', 0.25);
  for (let i = 0; i < 100; i++) { // ticks
    const a = -PI / 2 + (i / 100) * TAU, r0 = RR + 32, r1 = RR + (i % 10 === 0 ? 50 : 40);
    ctx.strokeStyle = `rgba(255,255,255,${i / 100 <= fill ? 0.5 : 0.12})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(rx + Math.cos(a) * r0, ry + Math.sin(a) * r0); ctx.lineTo(rx + Math.cos(a) * r1, ry + Math.sin(a) * r1); ctx.stroke();
  }
  text(ctx, (fill * 100).toFixed(2) + '%', rx, ry + 150, { size: 40, weight: 600, align: 'center', color: '#fff', alpha: inv(T(28, 1), T(28, 1.5), t) });
  ctx.restore();
  // grade slam
  const gk = inv(T(29), T(29) + 0.28, t);
  if (gk > 0) {
    ring(ctx, rx, ry, lerp(RR * 0.6, RR * 2.2, ease.outCubic(inv(T(29), T(29) + 0.7, t))), 12, '#FFE680', 0.8 * (1 - inv(T(29), T(29) + 0.7, t)));
    glow(ctx, rx, ry, 520, '#FFC94A', 0.45 * (1 - inv(T(29), T(29) + 1.2, t)) + 0.12);
    ctx.save(); ctx.translate(rx, ry + 8); const s = lerp(3.2, 1, ease.outBackBig(gk)); ctx.scale(s, s);
    const gg = ctx.createLinearGradient(0, -120, 0, 120); gg.addColorStop(0, '#FFF6C9'); gg.addColorStop(0.5, '#FFD045'); gg.addColorStop(1, '#FF9E1F');
    setFont(ctx, 260, 900, true); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha *= clamp(gk * 3);
    ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(80,30,0,0.55)'; ctx.lineJoin = 'round'; ctx.strokeText('SS', 0, 0);
    ctx.fillStyle = gg; ctx.fillText('SS', 0, 0);
    ctx.restore();
    burst(ctx, t, T(29), rx, ry, 77, { n: 60, dist: 520, colors: ['#FFE680', '#FFFFFF', '#FFB21C', PAL.pink] });
  }
  // stats panel
  const rows = [
    ['SCORE', FINAL_SCORE.toLocaleString('en-US'), '#fff', 64],
    ['ACCURACY', '100.00%', '#fff', 46], ['MAX COMBO', MAX_COMBO + 'x', '#fff', 46], ['PP', '727', PAL.pink, 46],
  ];
  const px = 1060;
  rows.forEach(([lab, val, col, sz], i) => {
    const t0 = T(29, 0.25) + i * 0.09, k = ease.outCubic(inv(t0, t0 + 0.4, t));
    if (k <= 0) return;
    const y = 240 + i * 130 + (i ? 40 : 0);
    ctx.save(); ctx.globalAlpha *= k; ctx.translate((1 - k) * 220, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); ctx.roundRect(px, y - 70, 760, i ? 108 : 150, 18); ctx.fill();
    text(ctx, lab, px + 34, y - 30, { size: 22, weight: 700, spacing: 4, color: '#a69dc7' });
    let shown = val;
    if (i === 0) shown = Math.round(FINAL_SCORE * ease.outCubic(inv(t0, t0 + 1.2, t))).toLocaleString('en-US');
    text(ctx, shown, px + 34, y + (i ? 22 : 50), { size: sz, weight: 600, color: col });
    ctx.restore();
  });
  // judgement counts
  const J = [['300', N300, JUDGE[300]], ['100', 0, JUDGE[100]], ['50', 0, JUDGE[50]], ['MISS', 0, JUDGE[0]]];
  J.forEach(([lab, n, c], i) => {
    const t0 = T(29, 1.2) + i * 0.07, k = ease.outBack(inv(t0, t0 + 0.35, t));
    if (k <= 0) return;
    const x = px + i * 192, y = 860;
    ctx.save(); ctx.globalAlpha *= clamp(k); ctx.translate(x + 88, y); ctx.scale(k, k);
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.strokeStyle = rgba(c, 0.7); ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.roundRect(-88, -60, 176, 120, 18); ctx.fill(); ctx.stroke();
    text(ctx, lab, 0, -18, { size: 26, weight: 700, align: 'center', color: rgba(lighten(c, 0.25)), spacing: 2 });
    text(ctx, String(n), 0, 34, { size: 44, weight: 600, align: 'center', color: '#fff' });
    ctx.restore();
  });
  // FULL COMBO stamp
  const sk = inv(T(30), T(30) + 0.2, t);
  if (sk > 0) {
    ctx.save(); ctx.translate(rx, ry + RR + 120); ctx.rotate(-0.05); const s = lerp(2, 1, ease.outBack(sk)); ctx.scale(s, s); ctx.globalAlpha *= clamp(sk * 2);
    ctx.fillStyle = PAL.pink; ctx.beginPath(); ctx.roundRect(-200, -40, 400, 80, 40); ctx.fill();
    text(ctx, 'FULL COMBO', 0, 3, { size: 44, weight: 900, italic: true, align: 'center', baseline: 'middle', color: '#fff', spacing: 3 });
    ctx.restore();
  }
  ctx.restore();
}

// ---------- scene 7: outro ----------
const OUT_R = 236, OUT_Y = 460;
cue(T(35), 'hit', { s: 'finish', pan: 0, vol: 1 });
cue(T(35), 'click', { pan: 0 });

function sOutro(ctx, t) {
  fillGrad(ctx, '#1d0f24', '#0d0710');
  triPlum.draw(ctx, travelMenu(t), 1);
  const ina = ease.outBack(inv(T(32), T(32, 1.2), t));
  const hit = flashAt(t, T(35), 6);
  const R = OUT_R * lerp(0.6, 1, ina) * (1 + 0.025 * pulse(t, 6) * (t < T(35) ? 1 : 0) + 0.08 * hit);
  visualiser(ctx, CX, OUT_Y, R * 0.98, t, 0.8, 0.25 * inv(T(32), T(33), t) * (1 - inv(T(35), T(36), t)));
  burst(ctx, t, T(35), CX, OUT_Y, 91, { n: 80, dist: 1000 });
  drawCookie(ctx, CX, OUT_Y, R, clamp(inv(T(32), T(32, 0.5), t)));
  // final approach circle
  if (t >= T(34) && t < T(35) + 0.5) {
    if (t < T(35)) { const k = inv(T(34), T(35), t); ring(ctx, CX, OUT_Y, lerp(900, OUT_R, k), 10, '#ffffff', ease.inQuad(clamp(k * 1.4)) * 0.9); }
    else { const k = inv(T(35), T(35) + 0.5, t); ring(ctx, CX, OUT_Y, lerp(OUT_R, OUT_R * 2.2, ease.outCubic(k)), 16 * (1 - k), '#ffffff', 1 - k); }
  }
  // tagline
  const words = [['rhythm', '#fff'], ['is', '#fff'], ['just', '#fff'], ['a', '#fff'], ['click', PAL.pink], ['away', '#fff']];
  const sp = measure(ctx, ' ', 64, 800, true);
  const ws = words.map(w => measure(ctx, w[0], 64, 800, true));
  let x = CX - (ws.reduce((a, b) => a + b, 0) + sp * (words.length - 1)) / 2;
  words.forEach(([w, c], i) => {
    kinetic(ctx, w, x, 840, t, { size: 64, weight: 800, italic: true, color: c, t0: T(32, 2) + i * 0.09, stagger: 0.02, dur: 0.35 });
    x += ws[i] + sp;
  });
  const ua = inv(T(33, 1), T(33, 2), t);
  text(ctx, 'osu.ppy.sh', CX, 918, { size: 36, weight: 600, align: 'center', color: PAL.pinkLight, alpha: ua, spacing: 4 });
  text(ctx, 'fan-made motion graphic  ·  not affiliated with ppy Pty Ltd  ·  osu! and the cookie logo are trademarks of ppy Pty Ltd', CX, 1046, { size: 19, weight: 500, align: 'center', color: '#ffffff', alpha: 0.45 * inv(T(33, 2), T(34), t) });
  const fade = inv(T(35, 1), T(36, 2), t);
  if (fade > 0) { ctx.fillStyle = `rgba(0,0,0,${ease.inOutQuad(fade)})`; ctx.fillRect(0, 0, W, H); }
}

// ---------- transitions ----------
function iris(ctx, t, t0, t1, cx, cy, next, color = '#ffffff') {
  const k = inv(t0, t1, t); if (k <= 0) return;
  const R = ease.inOutCubic(k) * Math.hypot(W, H) * 1.05;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.clip(); next(ctx, t); ctx.restore();
  ring(ctx, cx, cy, R, 18 * (1 - k) + 3, color, 0.9 * (1 - k * k));
  ring(ctx, cx, cy, R * 0.9, 4, color, 0.4 * (1 - k));
}
function slash(ctx, t, t0, t1, next, dir = 1) {
  // skewed band sweeps across, revealing the next scene behind it
  const k = inv(t0, t1, t); if (k <= 0) return;
  const e = ease.inOutCubic(k), sk = 420, span = W + sk * 2;
  const edge = dir > 0 ? -sk + e * span : W + sk - e * span;
  ctx.save(); ctx.beginPath();
  if (dir > 0) { ctx.moveTo(-sk, 0); ctx.lineTo(edge + sk / 2, 0); ctx.lineTo(edge - sk / 2, H); ctx.lineTo(-sk, H); }
  else { ctx.moveTo(W + sk, 0); ctx.lineTo(edge + sk / 2, 0); ctx.lineTo(edge - sk / 2, H); ctx.lineTo(W + sk, H); }
  ctx.closePath(); ctx.clip(); next(ctx, t); ctx.restore();
  const bands = [[PAL.pink, 70], [PAL.purple, 36], ['#ffffff', 10]];
  let off = 0;
  for (const [c, w] of bands) {
    const ex = edge + (dir > 0 ? -off : off);
    ctx.save(); ctx.globalAlpha = Math.sin(k * PI) * 0.95; ctx.fillStyle = c; ctx.beginPath();
    ctx.moveTo(ex + sk / 2, 0); ctx.lineTo(ex + sk / 2 + w * dir, 0); ctx.lineTo(ex - sk / 2 + w * dir, H); ctx.lineTo(ex - sk / 2, H); ctx.closePath(); ctx.fill(); ctx.restore();
    off += w + 14;
  }
}

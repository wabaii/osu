'use strict';
// Timeline, transitions, asset loading and the in-browser preview player.

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
let _buffer = null;

// draw scene B over scene A with opacity k (B rendered into an offscreen buffer)
function xfade(t, k, a, b) {
  if (k <= 0) return a(ctx, t);
  if (k >= 1) return b(ctx, t);
  a(ctx, t);
  if (!_buffer) _buffer = makeCanvas(W, H);
  const g = _buffer.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H);
  b(g, t);
  ctx.save(); ctx.globalAlpha = k; ctx.drawImage(_buffer, 0, 0); ctx.restore();
}

// dip through black: A fades out over the first half, B fades in over the second
function dip(t, k, a, b) {
  const f = k < 0.5 ? a : b, d = k < 0.5 ? k * 2 : (1 - k) * 2;
  f(ctx, t);
  if (d > 0) { ctx.save(); ctx.globalAlpha = ease.inOutQuad(clamp(d)); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
}

const TIMELINE = [
  [0, WELCOME_END, t => sWelcome(ctx, t)],
  [WELCOME_END, M.clickSolo + 0.2, t => { sMenu(ctx, t); welcomeFade(t); }],
  [M.clickSolo + 0.2, SS.go + 0.3, t => xfade(t, inv(M.clickSolo + 0.2, M.clickSolo + 0.6, t), sMenu, sSongSelect)],
  [SS.go + 0.3, LOADER_END - 0.45, t => xfade(t, ease.inOutQuad(inv(SS.go + 0.3, SS.go + 0.8, t)), sSongSelect, sLoader)],
  [LOADER_END - 0.45, CB(16, 0.3), t => xfade(t, ease.inOutQuad(inv(LOADER_END - 0.45, LOADER_END + 0.25, t)), sLoader, sGameplay)],
  [CB(16, 0.3), CB(24) - 0.35, t => dip(t, inv(CB(16, 0.25), RES.t0 + 0.15, t), sGameplay, sResults)],
  [CB(24) - 0.35, Infinity, t => dip(t, inv(CB(24) - 0.3, CB(24) + 0.1, t), sResults, sOutro)],
];
// the welcome intro's ring fades out over the menu for its last 200ms
function welcomeFade(t) {
  const k = 1 - inv(WELCOME_END, WELCOME_END + 0.2, t);
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha = k; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore();
}
const FLASHES = [[KIAI_START, 6, 0.25], [CB(16), 4, 0.55], [RES.rank, 5, 0.18]];

// official music: "welcome to osu!" under the intro/menu/song select, "circles!" for gameplay and
// results (lazer keeps the beatmap's track playing on the results screen), "triangles" for the outro
(() => {
  const wEnd = TRACKS.circles.start + 1.4;
  cue(WELCOME_END, 'music', { track: 'welcome', from: 0, until: wEnd - WELCOME_END, fadeOut: 2.4, vol: 0.9 });
  cue(TRACKS.circles.start, 'music', { track: 'circles', from: 0, until: CB(24) + 0.4 - TRACKS.circles.start, fadeOut: 1.1, vol: 0.9 });
  const ts = TB(-1), tEnd = DURATION - 0.2;
  cue(ts, 'music', { track: 'triangles', from: ts - TRACKS.triangles.start, until: tEnd - TRACKS.triangles.start, fadeIn: 1.2, fadeOut: tEnd - (OUT.exit + 0.3), vol: 0.9 });
})();

function renderFrame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  for (const [a, b, f] of TIMELINE) if (t >= a && t < b) { f(t); break; }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  let fl = 0;
  for (const [t0, dec, a] of FLASHES) fl += a * flashAt(t, t0, dec);
  if (fl > 0.002) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, fl)})`; ctx.fillRect(0, 0, W, H); }
}

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('missing ' + src)); i.src = src; });
}

async function loadSpectrum() {
  try {
    const r = await fetch('../build/spectrum.bin');
    if (!r.ok) return;
    const buf = await r.arrayBuffer(), head = new Uint32Array(buf, 0, 2);
    SPECTRUM.frames = head[0]; SPECTRUM.bands = head[1];
    SPECTRUM.data = new Uint8Array(buf, 8, SPECTRUM.frames * SPECTRUM.bands);
    SPECTRUM.amp = new Uint8Array(buf, 8 + SPECTRUM.frames * SPECTRUM.bands, SPECTRUM.frames);
  } catch (e) { /* preview without audio analysis */ }
}

window.ready = (async () => {
  const A = 'assets/official/';
  const imgs = {
    logo: 'menu-logo.png', welcome: 'welcome_text.png', welcomeBg: 'welcome-menu-background.jpg', menuBg1: 'menu-background-1.jpg',
    circlesBg: 'circles-background.jpg', hallsBg: 'circle-the-halls-bg.jpg', star: 'fountain-star.png', approach: 'approachcircle.png',
    edge: 'repeat-edge-piece.png', trail: 'cursortrail.png', menuCursor: 'menu-cursor.png',
  };
  await Promise.all(Object.entries(imgs).map(async ([k, f]) => { IMG[k] = await loadImage(A + f); }));
  IMG.argon = {};
  await Promise.all(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'dot', 'percentage', 'x', 'wireframes'].map(async k => { IMG.argon[k] = await loadImage(`${A}argon-counter/argon-counter-${k}.png`); }));
  await loadSpectrum();
  const faces = [['Outfit', [300, 400, 500, 600, 700, 800]], ['Michroma', [400]]];
  await Promise.all(faces.flatMap(([f, ws]) => ws.map(w => document.fonts.load(`${w} 40px '${f}'`))));
  await document.fonts.ready;
  CUES.sort((a, b) => a.t - b.t);
  renderFrame(0);
  return true;
})();

window.renderFrame = renderFrame;
window.getMeta = () => ({ W, H, FPS, DURATION, tracks: TRACKS, cues: CUES });

// ---------- preview player (npm run preview) ----------
if (!/[?&]render\b/.test(location.search)) {
  const ui = document.getElementById('ui'), audio = document.getElementById('music');
  ui.style.display = 'flex';
  let playing = false, t0 = 0, offset = 0;
  const now = () => (audio && audio.readyState >= 2 && !audio.error ? audio.currentTime : offset + (playing ? (performance.now() - t0) / 1000 : 0));
  const loop = () => {
    const t = Math.min(now(), DURATION);
    renderFrame(t);
    document.getElementById('time').textContent = t.toFixed(2) + 's';
    if (playing && t < DURATION) requestAnimationFrame(loop); else playing = false;
  };
  const start = (from = 0) => {
    playing = true; offset = from; t0 = performance.now();
    if (audio) { audio.currentTime = from; audio.play().catch(() => {}); }
    ui.querySelector('button').textContent = 'restart';
    requestAnimationFrame(loop);
  };
  ui.querySelector('button').onclick = () => start(0);
  window.addEventListener('keydown', e => {
    if (e.key === ' ') { e.preventDefault(); start(0); }
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') start(clamp(now() + (e.key === 'ArrowRight' ? 3 : -3), 0, DURATION));
  });
}

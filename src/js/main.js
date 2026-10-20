'use strict';
// Timeline, transitions, global overlays, asset loading and the in-browser preview player.

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

function countdownOverlay(ctx, t) {
  // "GO!" carries across the cut into the kiai section
  const t0 = T(19, 3), dt = t - t0;
  if (dt < 0 || dt > BEAT + 0.1) return;
  const k = ease.outBack(inv(0, 0.18, dt)), out = inv(BEAT * 0.5, BEAT + 0.1, dt);
  ring(ctx, CX, CY + 20, lerp(120, 330, ease.outCubic(inv(0, BEAT, dt))), 10 * (1 - out), PAL.yellow, 0.8 * (1 - out));
  ctx.save(); ctx.translate(CX, CY + 20); const s = lerp(2.2, 1, k) * (1 + 0.25 * out); ctx.scale(s, s);
  text(ctx, 'GO!', 0, 8, { size: 230, weight: 900, italic: true, align: 'center', baseline: 'middle', color: '#fff', alpha: clamp(inv(0, 0.06, dt)) * (1 - out), shadow: { color: rgba(PAL.yellow, 0.9), blur: 40 } });
  ctx.restore();
}

const TIMELINE = [
  [0, T(4), t => sIntro(ctx, t)],
  [T(4), T(8), t => { sMenu(ctx, t); iris(ctx, t, T(7, 2.5), T(8), 1260, 372, sCircles); }],
  [T(8), T(12, 0.25), t => { sCircles(ctx, t); slash(ctx, t, T(11, 3.25), T(12, 0.25), sSliders, 1); }],
  [T(12, 0.25), T(16, 0.25), t => { sSliders(ctx, t); iris(ctx, t, T(15, 3.25), T(16, 0.25), SPX, SPY, sSpinner, PAL.yellow); }],
  [T(16, 0.25), T(19, 3), t => sSpinner(ctx, t)],
  [T(19, 3), T(28, 0.6), t => { sKiai(ctx, t); countdownOverlay(ctx, t); iris(ctx, t, T(28), T(28, 0.6), kiai.objs[kiai.objs.length - 1].x, kiai.objs[kiai.objs.length - 1].y, sResults); }],
  [T(28, 0.6), T(32, 1), t => { sResults(ctx, t); slash(ctx, t, T(31, 3), T(32, 1), sOutro, -1); }],
  [T(32, 1), Infinity, t => sOutro(ctx, t)],
];
const FLASHES = [[T(4), 4.5, 1.0], [T(19, 3), 7, 0.55], [T(20), 5, 0.7], [T(24), 6, 0.35], [T(28), 5, 0.85], [T(29), 6, 0.3], [T(35), 5, 0.5]];

function renderFrame(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  for (const [a, b, f] of TIMELINE) if (t >= a && t < b) { f(t); break; }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
  vignette(ctx, 0.42);
  let fl = 0;
  for (const [t0, dec, a] of FLASHES) fl += a * flashAt(t, t0, dec);
  if (fl > 0.002) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, fl)})`; ctx.fillRect(0, 0, W, H); }
}

function loadImage(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}

window.ready = (async () => {
  IMG.cookie = await loadImage('assets/osu-cookie.png');
  const faces = ['400', '500', '600', '700', '800', '900'];
  await Promise.all(faces.flatMap(w => [document.fonts.load(`${w} 40px 'Exo 2'`), document.fonts.load(`italic ${w} 40px 'Exo 2'`)]));
  await document.fonts.ready;
  CUES.sort((a, b) => a.t - b.t);
  renderFrame(0);
  return true;
})();

window.renderFrame = renderFrame;
window.getMeta = () => ({ W, H, FPS, BPM, DURATION, cues: CUES });

// ---------- preview player (open src/index.html in a browser) ----------
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
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const tt = clamp(now() + (e.key === 'ArrowRight' ? 3 : -3), 0, DURATION); start(tt); }
  });
}

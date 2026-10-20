'use strict';
// The scenes of the video, styled after osu!lazer. Every function is a pure function of time t.

const CX = W / 2, CY = H / 2;

// ---------- shared lazer UI pieces ----------
const _blur = new Map();
function blurred(img, px) {
  const key = img.src + px;
  if (_blur.has(key)) return _blur.get(key);
  const c = makeCanvas(W, H), g = c.getContext('2d');
  g.filter = `blur(${px}px)`; g.drawImage(img, -px * 2, -px * 2, W + px * 4, H + px * 4); g.filter = 'none';
  _blur.set(key, c); return c;
}
function background(ctx, img, alpha = 1, o = {}) {
  if (!img || alpha <= 0) return;
  const { blur = 0, dim = 0, zoom = 1, ox = 0, oy = 0 } = o;
  const src = blur ? blurred(img, blur) : img;
  ctx.save(); ctx.globalAlpha *= alpha;
  const w = W * zoom, h = H * zoom;
  ctx.drawImage(src, CX - w / 2 + ox, CY - h / 2 + oy, w, h);
  if (dim) { ctx.fillStyle = `rgba(0,0,0,${dim})`; ctx.fillRect(0, 0, W, H); }
  ctx.restore();
}

// STAR_DIFFICULTY_SPECTRUM (OsuColour.cs)
const STAR_SPEC = [[0.1, '#aaaaaa'], [0.1, '#4290fb'], [1.25, '#4fc0ff'], [2.0, '#4fffd5'], [2.5, '#7cff4f'], [3.3, '#f6f05c'], [4.2, '#ff8068'], [4.9, '#ff4e6f'], [5.8, '#c645b8'], [6.7, '#6563de'], [7.7, '#18158e'], [9.0, '#000000']];
function starColour(sr) {
  for (let i = 1; i < STAR_SPEC.length; i++) if (sr <= STAR_SPEC[i][0]) return mix(STAR_SPEC[i - 1][1], STAR_SPEC[i][1], inv(STAR_SPEC[i - 1][0], STAR_SPEC[i][0], sr));
  return toRgb('#000000');
}
function starPill(ctx, x, y, sr, h = 26, alpha = 1) {
  const c = starColour(sr), s = '★ ' + sr.toFixed(2), w = measure(ctx, s, h * 0.62, 700) + h * 0.9;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = rgba(c); roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
  text(ctx, s, x + w / 2, y + h / 2 + 1, { size: h * 0.62, weight: 700, align: 'center', baseline: 'middle', color: sr > 6.5 ? '#ffd966' : 'rgba(0,0,0,0.75)' });
  ctx.restore(); return w;
}

// ---------- the osu! logo as lazer draws it (OsuLogo.cs) ----------
// pink vertical gradient + outlined triangles, under the official white logo texture
const logoTris = new TriField(5, 26, { minS: 0.2, maxS: 0.75, w: 1, h: 1, outline: 0.035 });
function logoTravel(t) {
  // triangles drift up and get a velocity bump on every beat
  const bi = beatInfo(t);
  return t * 0.03 + bi.idx * 0.012 + 0.012 * (1 - Math.exp(-bi.since * 3));
}
function drawLogo(ctx, x, y, R, t, o = {}) {
  const { alpha = 1, beat = true, flash = 0, visual = 0.5, ripple = true } = o;
  if (alpha <= 0 || !IMG.logo) return;
  const bi = beatInfo(t), amp = Math.min(1, 0.4 + ampAt(t));
  // beat bounce: dip on the beat, recover over two beats
  let s = 1;
  if (beat) { const k = inv(0, 0.06, bi.since); s = k < 1 ? lerp(1, 1 - 0.02 * amp, ease.outQuad(k)) : lerp(1 - 0.02 * amp, 1, ease.outQuint(inv(0.06, 0.06 + bi.len * 2, bi.since))); }
  const r = R * s;
  ctx.save(); ctx.globalAlpha *= alpha;
  if (visual > 0) visualiser(ctx, x, y, r * 0.94, t, visual * (bi.kiai ? 1.4 : 1));
  if (ripple && beat) {
    const k = ease.outQuint(inv(0, bi.len, bi.since)), ra = 0.15 * amp * (1 - k);
    if (ra > 0) { ctx.save(); ctx.globalAlpha *= ra; ctx.globalCompositeOperation = 'lighter'; const D = 2 * r * (1 + 0.04 * k); ctx.drawImage(IMG.logo, x - D / 2, y - D / 2, D, D); ctx.restore(); }
  }
  const pr = r * 0.94;
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, pr, 0, TAU); ctx.clip();
  const g = ctx.createLinearGradient(0, y - pr, 0, y + pr); g.addColorStop(0, '#ff66ab'); g.addColorStop(1, '#cc5289');
  ctx.fillStyle = g; ctx.fillRect(x - pr, y - pr, 2 * pr, 2 * pr);
  ctx.save(); ctx.translate(x - pr, y - pr); ctx.scale(2 * pr, 2 * pr);
  logoTris.draw(ctx, logoTravel(t), (shade, yy) => [rgba(mix('#ff66ab', '#b6346f', clamp(yy))), 0.85], 1);
  ctx.restore();
  const kf = bi.kiai ? 0.2 * amp * (1 - ease.outQuint(inv(0.06, 0.06 + bi.len, bi.since))) : 0;
  if (kf + flash > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, kf + flash)})`; ctx.fillRect(x - pr, y - pr, 2 * pr, 2 * pr); }
  ctx.restore();
  ctx.drawImage(IMG.logo, x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
}

// LogoVisualisation: 200 bars per round, 5 rounds, lengths driven by the mix's spectrum
function visualiser(ctx, x, y, R, t, alpha = 0.5, color = '#ffffff', lenScale = 1) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = Math.max(2, (TAU * R / 200) * 0.75);
  ctx.beginPath();
  const rot = t * 0.12;
  for (let round = 0; round < 5; round++) for (let i = 0; i < 200; i++) {
    const band = (i * 3 + round * 41) % 64;
    const v = specAt(t, band) * (0.7 + 0.3 * noise1(i * 0.5 + round * 9 + t * 2));
    const L = Math.max(0, v * R * 1.25 * lenScale - 2);
    if (L < 1) continue;
    const a = rot + (i / 200) * TAU + (round / 5) * TAU;
    ctx.moveTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
    ctx.lineTo(x + Math.cos(a) * (R + L), y + Math.sin(a) * (R + L));
  }
  ctx.stroke(); ctx.restore();
}

// ---------- icons (simple vector stand-ins for OsuIcon / FontAwesome) ----------
function icon(ctx, kind, x, y, s, color = '#fff') {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = s * 0.09; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const circ = () => { ctx.beginPath(); ctx.arc(0, 0, s * 0.45, 0, TAU); ctx.stroke(); };
  switch (kind) {
    case 'logo': circ(); text(ctx, 'osu!', 0, s * 0.03, { size: s * 0.36, weight: 700, align: 'center', baseline: 'middle', color }); break;
    case 'edit': circ(); ctx.rotate(-PI / 4); ctx.strokeRect(-s * 0.22, -s * 0.07, s * 0.36, s * 0.14); ctx.beginPath(); ctx.moveTo(s * 0.14, -s * 0.07); ctx.lineTo(s * 0.25, 0); ctx.lineTo(s * 0.14, s * 0.07); ctx.stroke(); break;
    case 'browse': circ(); ctx.beginPath(); ctx.moveTo(-s * 0.18, -s * 0.06); ctx.lineTo(0, s * 0.12); ctx.lineTo(s * 0.18, -s * 0.06); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-s * 0.18, -s * 0.2); ctx.lineTo(0, -s * 0.02); ctx.lineTo(s * 0.18, -s * 0.2); ctx.stroke(); break;
    case 'exit': circ(); ctx.beginPath(); ctx.moveTo(-s * 0.15, -s * 0.15); ctx.lineTo(s * 0.15, s * 0.15); ctx.moveTo(s * 0.15, -s * 0.15); ctx.lineTo(-s * 0.15, s * 0.15); ctx.stroke(); break;
    case 'settings':
      ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.moveTo(Math.cos(a) * s * 0.28, Math.sin(a) * s * 0.28); ctx.lineTo(Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.42); } ctx.lineWidth = s * 0.14; ctx.stroke();
      ctx.lineWidth = s * 0.09; ctx.beginPath(); ctx.arc(0, 0, s * 0.28, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, s * 0.1, 0, TAU); ctx.stroke(); break;
    case 'back': circ(); ctx.beginPath(); ctx.moveTo(s * 0.06, -s * 0.16); ctx.lineTo(-s * 0.12, 0); ctx.lineTo(s * 0.06, s * 0.16); ctx.stroke(); break;
    case 'solo': ctx.beginPath(); ctx.arc(0, -s * 0.16, s * 0.15, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(0, s * 0.32, s * 0.3, PI, TAU); ctx.fill(); break;
    case 'multi': ctx.beginPath(); ctx.arc(-s * 0.16, -s * 0.12, s * 0.12, 0, TAU); ctx.arc(s * 0.18, -s * 0.12, s * 0.12, 0, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(-s * 0.16, s * 0.3, s * 0.24, PI, TAU); ctx.fill(); ctx.beginPath(); ctx.arc(s * 0.18, s * 0.3, s * 0.24, PI, TAU); ctx.fill(); break;
    case 'playlists': ctx.beginPath(); ctx.moveTo(-s * 0.24, -s * 0.3); ctx.lineTo(s * 0.24, -s * 0.3); ctx.lineTo(s * 0.18, s * 0.02); ctx.quadraticCurveTo(0, s * 0.16, -s * 0.18, s * 0.02); ctx.closePath(); ctx.fill(); ctx.fillRect(-s * 0.04, s * 0.08, s * 0.08, s * 0.16); ctx.fillRect(-s * 0.16, s * 0.24, s * 0.32, s * 0.08); break;
    case 'daily': ctx.strokeRect(-s * 0.3, -s * 0.24, s * 0.6, s * 0.52); ctx.beginPath(); ctx.moveTo(-s * 0.3, -s * 0.08); ctx.lineTo(s * 0.3, -s * 0.08); ctx.moveTo(-s * 0.14, -s * 0.34); ctx.lineTo(-s * 0.14, -s * 0.18); ctx.moveTo(s * 0.14, -s * 0.34); ctx.lineTo(s * 0.14, -s * 0.18); ctx.stroke(); break;
    case 'home': ctx.beginPath(); ctx.moveTo(-s * 0.32, -s * 0.02); ctx.lineTo(0, -s * 0.3); ctx.lineTo(s * 0.32, -s * 0.02); ctx.stroke(); ctx.strokeRect(-s * 0.2, -s * 0.06, s * 0.4, s * 0.32); break;
    case 'osu': ring(ctx, 0, 0, s * 0.36, s * 0.1, color); disc(ctx, 0, 0, s * 0.13, color); break;
    case 'taiko': ring(ctx, 0, 0, s * 0.36, s * 0.1, color); ctx.beginPath(); ctx.moveTo(0, -s * 0.3); ctx.lineTo(0, s * 0.3); ctx.stroke(); break;
    case 'catch': ring(ctx, 0, 0, s * 0.36, s * 0.1, color); disc(ctx, -s * 0.08, s * 0.08, s * 0.07, color); disc(ctx, s * 0.1, -s * 0.06, s * 0.07, color); break;
    case 'mania': ring(ctx, 0, 0, s * 0.36, s * 0.1, color); ctx.fillRect(-s * 0.14, -s * 0.16, s * 0.07, s * 0.32); ctx.fillRect(s * 0.07, -s * 0.16, s * 0.07, s * 0.32); break;
    case 'chat': ctx.strokeRect(-s * 0.3, -s * 0.24, s * 0.6, s * 0.4); ctx.beginPath(); ctx.moveTo(-s * 0.12, s * 0.16); ctx.lineTo(-s * 0.2, s * 0.3); ctx.lineTo(s * 0.02, s * 0.16); ctx.stroke(); break;
    case 'music': ctx.beginPath(); ctx.moveTo(-s * 0.08, s * 0.2); ctx.lineTo(-s * 0.08, -s * 0.28); ctx.lineTo(s * 0.24, -s * 0.34); ctx.lineTo(s * 0.24, s * 0.12); ctx.stroke(); disc(ctx, -s * 0.16, s * 0.22, s * 0.09, color); disc(ctx, s * 0.16, s * 0.14, s * 0.09, color); break;
    case 'news': ctx.strokeRect(-s * 0.3, -s * 0.26, s * 0.6, s * 0.52); ctx.beginPath(); for (let i = 0; i < 3; i++) { ctx.moveTo(-s * 0.18, -s * 0.1 + i * s * 0.12); ctx.lineTo(s * 0.18, -s * 0.1 + i * s * 0.12); } ctx.stroke(); break;
    case 'search': ring(ctx, -s * 0.06, -s * 0.06, s * 0.2, s * 0.09, color); ctx.beginPath(); ctx.moveTo(s * 0.09, s * 0.09); ctx.lineTo(s * 0.26, s * 0.26); ctx.stroke(); break;
    case 'heart': ctx.beginPath(); ctx.moveTo(0, s * 0.28); ctx.bezierCurveTo(-s * 0.5, -s * 0.05, -s * 0.2, -s * 0.42, 0, -s * 0.14); ctx.bezierCurveTo(s * 0.2, -s * 0.42, s * 0.5, -s * 0.05, 0, s * 0.28); ctx.fill(); break;
    case 'play': ctx.beginPath(); ctx.moveTo(-s * 0.18, -s * 0.26); ctx.lineTo(s * 0.26, 0); ctx.lineTo(-s * 0.18, s * 0.26); ctx.closePath(); ctx.fill(); break;
    case 'clock': ring(ctx, 0, 0, s * 0.34, s * 0.09, color); ctx.beginPath(); ctx.moveTo(0, -s * 0.18); ctx.lineTo(0, 0); ctx.lineTo(s * 0.13, s * 0.08); ctx.stroke(); break;
  }
  ctx.restore();
}

// ---------- toolbar (Toolbar.cs, 40 units tall) ----------
function toolbar(ctx, t, show) {
  if (show <= 0) return;
  const h = 40 * UI, y0 = -h * (1 - ease.outQuint(show));
  ctx.save(); ctx.translate(0, y0);
  ctx.fillStyle = 'rgba(26,26,26,0.94)'; ctx.fillRect(0, 0, W, h);
  const sh = ctx.createLinearGradient(0, h, 0, h + 30); sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sh; ctx.fillRect(0, h, W, 30);
  const is = h * 0.48;
  icon(ctx, 'settings', h / 2, h / 2, is); icon(ctx, 'home', h * 1.5, h / 2, is);
  ['osu', 'taiko', 'catch', 'mania'].forEach((k, i) => {
    const x = h * 2.6 + i * h;
    icon(ctx, k, x, h / 2, is * 0.95, i === 0 ? '#ffffff' : 'rgba(255,255,255,0.45)');
    if (i === 0) { glow(ctx, x, h - 3, 30, PAL.pink, 0.25); ctx.fillStyle = PAL.pink; ctx.fillRect(x - h * 0.3, h - 4, h * 0.6, 4); }
  });
  ['news', 'chat', 'music'].forEach((k, i) => icon(ctx, k, W - h * 6.4 + i * h, h / 2, is * 0.9));
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(W - h * 3.4, 0, h * 2.2, h);
  disc(ctx, W - h * 3.0, h / 2, h * 0.3, PAL.purpleLight); icon(ctx, 'solo', W - h * 3.0, h / 2 + 2, h * 0.42, '#2a2040');
  text(ctx, 'Guest', W - h * 2.55, h / 2 + 1, { size: 20, weight: 600, baseline: 'middle' });
  text(ctx, '13:37', W - h * 0.55, h / 2 + 1, { size: 20, weight: 600, align: 'right', baseline: 'middle', color: '#ddd' });
  ctx.restore();
}

// SongTicker.cs: title/artist slide in under the toolbar when the track changes
function songTicker(ctx, t, t0, title, artist, hold = 4) {
  const a = win(t, t0, t0 + 0.5, t0 + hold, t0 + hold + 0.5, ease.outQuint, ease.inQuad);
  if (a <= 0) return;
  const dx = (1 - ease.outQuint(inv(t0, t0 + 0.5, t))) * 40;
  text(ctx, title, W - 30 + dx, 110, { size: 34, weight: 600, align: 'right', alpha: a, shadow: { color: 'rgba(0,0,0,0.5)', blur: 8 } });
  text(ctx, artist, W - 30 + dx, 142, { size: 24, weight: 500, align: 'right', alpha: a * 0.85, shadow: { color: 'rgba(0,0,0,0.5)', blur: 8 } });
}

// tooltip-style callout for the tutorial bars
function callout(ctx, label, tx, ty, lx, ly, a, color = PAL.pink) {
  if (a <= 0) return;
  ctx.save(); ctx.globalAlpha *= a;
  const k = ease.outQuint(clamp(a)), mx = lerp(tx, lx, k), my = lerp(ty, ly, k);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(mx, my); ctx.stroke();
  disc(ctx, tx, ty, 5, '#fff');
  const w = measure(ctx, label, 26, 600) + 40, right = lx >= tx, bx = right ? mx : mx - w, by = my - 24;
  ctx.fillStyle = 'rgba(28,24,34,0.92)'; roundRect(ctx, bx, by, w, 48, 8); ctx.fill();
  ctx.fillStyle = color; roundRect(ctx, bx, by, 5, 48, [8, 0, 0, 8]); ctx.fill();
  text(ctx, label, bx + w / 2 + 2, my + 1, { size: 26, weight: 600, align: 'center', baseline: 'middle' });
  ctx.restore();
}

// ---------- scene 1: IntroWelcome (IntroWelcome.cs) ----------
cue(0, 'sample', { name: 'Intro/Welcome/welcome', vol: 1.0 });
cue(0, 'sample', { name: 'Intro/Welcome/welcome_piano', vol: 0.9 });
const WELCOME_END = TRACKS.welcome.start; // delay_step_two = 2142ms

function sWelcome(ctx, t) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const a = clamp(t / 1.8) * (1 - inv(WELCOME_END, WELCOME_END + 0.2, t));
  if (a <= 0) return;
  const s = lerp(0.9, 1, clamp(t / WELCOME_END)) * UI;
  ctx.save(); ctx.translate(CX, CY); ctx.scale(s, s); ctx.globalAlpha = a;
  visualiser(ctx, 0, 0, 240 * 0.94, t, 1, '#00008B', 1.1);
  disc(ctx, 0, 0, 240, '#000');
  if (IMG.welcome) {
    const ky = ease.outQuad(clamp(t / 0.4)), w = IMG.welcome.width * 0.62, h = IMG.welcome.height * 0.62 * ky;
    ctx.drawImage(IMG.welcome, -w / 2, -h / 2, w, h);
  }
  ctx.restore();
}

// ---------- scene 2: main menu (ButtonSystem.cs / MainMenuButton.cs) ----------
const BTN_W = 140 * UI, BTN_H = 100 * UI, WEDGE = 20 * UI, SHEAR = WEDGE / BTN_H;
const MENU = {
  top: [
    { label: 'settings', icon: 'settings', color: gray(85), side: 'left' },
    { label: 'play', icon: 'logo', color: [102, 68, 204] }, { label: 'edit', icon: 'edit', color: [238, 170, 0] },
    { label: 'browse', icon: 'browse', color: [165, 204, 0] }, { label: 'exit', icon: 'exit', color: [238, 51, 153] },
  ],
  play: [
    { label: 'back', icon: 'back', color: [51, 58, 94], side: 'left' },
    { label: 'solo', icon: 'solo', color: [102, 68, 204] }, { label: 'multi', icon: 'multi', color: [94, 63, 186] },
    { label: 'playlists', icon: 'playlists', color: [94, 63, 186] }, { label: 'daily challenge', icon: 'daily', color: [94, 63, 186] },
  ],
};
const LOGO_TOP = { x: 640, r: 150 };
const LOGO_INIT_R = 300;

// one sheared menu button. hover: widen 1.5x (elastic), icon bounces on the beat
function menuButton(ctx, b, x, y, t, o) {
  const { appear, hover, flash, leftSide } = o;
  if (appear <= 0) return;
  const w = BTN_W * lerp(1, 1.5, hover), bx = leftSide ? x - w : x;
  ctx.save(); ctx.globalAlpha *= clamp(appear * 1.5);
  ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 12;
  shearRect(ctx, bx, y - BTN_H / 2, w, BTN_H, SHEAR); ctx.fillStyle = rgba(b.color); ctx.fill();
  ctx.shadowColor = 'transparent';
  if (flash > 0) { ctx.fillStyle = `rgba(255,255,255,${flash})`; ctx.fill(); }
  const ix = bx + w / 2 + WEDGE / 2, bi = beatInfo(t);
  let iy = y - 10, is = 1, rot = 0;
  if (hover > 0.5) { const k = bi.since / bi.len; iy -= 10 * UI * Math.sin(k * PI) * hover; is = lerp(1.2, 1.08, k); rot = (bi.idx % 2 ? 1 : -1) * (8 * PI / 180) * Math.sin(k * PI); }
  ctx.save(); ctx.translate(ix, iy); ctx.rotate(rot); ctx.scale(is, is);
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 6; icon(ctx, b.icon, 0, 0, 32 * UI); ctx.restore();
  text(ctx, b.label, ix - 3, y + BTN_H / 2 - 7 * UI, { size: 16 * UI, weight: 600, align: 'center', baseline: 'bottom', shadow: { color: 'rgba(0,0,0,0.4)', blur: 4 } });
  ctx.restore();
}

// timings, on the beats of "welcome to osu!"
const M = { clickLogo: WB(8), hoverPlay: WB(10), clickPlay: WB(12), hoverSolo: WB(14), clickSolo: WB(16) };
cue(M.clickLogo, 'sample', { name: 'Menu/osu-logo-select', pan: 0 });
cue(M.hoverPlay, 'sample', { name: 'Menu/button-hover', vol: 0.8, pan: 0.1 });
cue(M.clickPlay, 'sample', { name: 'Menu/button-play-select', pan: 0.1 });
cue(M.hoverSolo, 'sample', { name: 'Menu/button-hover', vol: 0.8, pan: 0.1 });
cue(M.clickSolo, 'sample', { name: 'Menu/button-default-select', pan: 0.1 });
const menuCursor = new CursorPath()
  .point(WB(5), 1300, 900).point(M.clickLogo - 0.1, CX + 60, CY + 40).click(M.clickLogo)
  .point(M.hoverPlay, LOGO_TOP.x + LOGO_TOP.r + BTN_W * 0.75, CY + 10).point(M.clickPlay, LOGO_TOP.x + LOGO_TOP.r + BTN_W * 0.8, CY + 6).click(M.clickPlay)
  .point(M.hoverSolo, LOGO_TOP.x + LOGO_TOP.r + BTN_W * 0.7, CY + 16).point(M.clickSolo, LOGO_TOP.x + LOGO_TOP.r + BTN_W * 0.74, CY + 12).click(M.clickSolo)
  .point(WB(18), 1420, 380).done();

function buttonRow(ctx, t, set, t0, tOut, hoverIdx, tHover, tClick) {
  const lx = LOGO_TOP.x, r = LOGO_TOP.r;
  let rx = lx + r * 0.84;
  set.forEach((b, i) => {
    const d = i * 0.03, ap = ease.outQuint(inv(t0 + d, t0 + d + 0.45, t)) * (1 - ease.inQuint(inv(tOut, tOut + 0.25, t)));
    const hover = i === hoverIdx ? ease.outElastic(inv(tHover, tHover + 0.5, t)) * (1 - inv(tClick + 0.25, tClick + 0.4, t)) : 0;
    const flash = i === hoverIdx && t >= tClick ? 0.6 * (1 - ease.outQuint(inv(tClick, tClick + 0.4, t))) : 0;
    if (b.side === 'left') {
      menuButton(ctx, b, lerp(lx, lx - r * 0.84, ap), CY, t, { appear: ap, hover: 0, flash: 0, leftSide: true });
    } else {
      const w = BTN_W * lerp(1, 1.5, hover);
      menuButton(ctx, b, lerp(lx, rx, ap), CY, t, { appear: ap, hover, flash, leftSide: false });
      rx += w;
    }
  });
}

function sMenu(ctx, t) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  background(ctx, IMG.welcomeBg, inv(WELCOME_END, WELCOME_END + 0.2, t), { zoom: 1.02 + 0.01 * Math.sin(t * 0.3) });
  const open = ease.outQuint(inv(M.clickLogo, M.clickLogo + 0.5, t)) * (1 - ease.inQuint(inv(M.clickSolo + 0.15, M.clickSolo + 0.45, t)));
  if (open > 0) { ctx.fillStyle = `rgba(50,50,50,${0.85 * open})`; ctx.fillRect(0, CY - (BTN_H / 2) * open, W, BTN_H * open); }
  buttonRow(ctx, t, MENU.top, M.clickLogo + 0.05, M.clickPlay, 1, M.hoverPlay, M.clickPlay);
  buttonRow(ctx, t, MENU.play, M.clickPlay + 0.08, M.clickSolo + 0.1, 1, M.hoverSolo, M.clickSolo);
  // logo: centred and large, then into the bar, then off to the song select corner
  const k = ease.inOutQuint(inv(M.clickLogo, M.clickLogo + 0.6, t));
  let lx = lerp(CX, LOGO_TOP.x, k), lr = lerp(LOGO_INIT_R, LOGO_TOP.r, k);
  const leave = ease.inOutQuint(inv(M.clickSolo + 0.1, M.clickSolo + 0.7, t));
  lx = lerp(lx, W - 110, leave); const ly = lerp(CY, H - 70, leave); lr = lerp(lr, 120, leave);
  const flash = t >= M.clickLogo ? 0.4 * (1 - ease.outExpo(inv(M.clickLogo, M.clickLogo + 1.5, t))) : 0;
  const bounce = t >= M.clickLogo ? lerp(0.9, 1, ease.outElastic(inv(M.clickLogo, M.clickLogo + 0.5, t))) : 1;
  drawLogo(ctx, lx, ly, lr * bounce, t, { alpha: inv(WELCOME_END, WELCOME_END + 0.2, t), flash, visual: 0.5 * (1 - leave) });
  toolbar(ctx, t, inv(M.clickLogo, M.clickLogo + 0.5, t) * (1 - inv(M.clickSolo + 0.3, M.clickSolo + 0.6, t)));
  songTicker(ctx, t, WELCOME_END + 0.3, 'welcome to osu!', 'nekodex', 3.2);
  drawMenuCursor(ctx, menuCursor, t, inv(WB(5), WB(6), t));
}

// ---------- scene 3: song select V2 ----------
const SS = { t0: M.clickSolo + 0.25, select: WB(20), diff: WB(22), go: WB(26) };
const SETS = [
  { title: 'circle the halls', artist: 'nekodex', mapper: 'pishifat', img: 'hallsBg', diffs: [['laser show', 4.81]] },
  { title: 'circles!', artist: 'nekodex', mapper: 'peppy', img: 'circlesBg', diffs: [['Easy', 1.84], ['Normal', 2.65], ['Tribute', 5.27]] },
  { title: 'triangles', artist: 'cYsmix', mapper: 'peppy', img: 'menuBg1', diffs: [['peppy', 3.12]] },
  { title: 'welcome to osu!', artist: 'nekodex', mapper: 'peppy', img: 'welcomeBg', diffs: [['Normal', 1.52]] },
];
cue(SS.t0 + 0.15, 'sample', { name: 'SongSelect/metadata-wedge-pop-in', vol: 0.8 });
cue(SS.select, 'sample', { name: 'SongSelect/select-expand', pan: 0.3 });
cue(SS.diff, 'sample', { name: 'SongSelect/select-difficulty', pan: 0.3 });
cue(SS.go, 'sample', { name: 'Menu/osu-logo-select', pan: 0.5 });
cue(SS.go, 'sample', { name: 'SongSelect/confirm-selection', vol: 0.8, pan: 0.5 });
const ssCursor = new CursorPath().point(SS.t0, 1420, 380).point(SS.select - 0.05, 1300, 480).click(SS.select)
  .point(SS.diff - 0.05, 1380, 742).click(SS.diff).point(SS.go - 0.05, W - 120, H - 80).click(SS.go).point(SS.go + 1, W - 200, H - 150).done();

function carousel(ctx, t, appear) {
  // the carousel scrolls from "welcome to osu!" (the current track) to "circles!"
  const sel = ease.inOutQuint(inv(SS.select, SS.select + 0.45, t)), focus = lerp(3, 1, sel);
  const panelH = 92 * UI * 0.82, gap = 12, diffH = 56 * UI * 0.82, x0 = 1010, w = 1000;
  let y = CY - focus * (panelH + gap) - panelH / 2 + 20;
  SETS.forEach((s, i) => {
    const d = i * 0.06, ap = ease.outQuint(inv(SS.t0 + d, SS.t0 + d + 0.5, t)) * appear;
    if (ap <= 0) { y += panelH + gap; return; }
    const isSel = i === 1, x = x0 + (1 - ap) * 600 + (isSel ? -40 * sel : Math.abs(i - focus) * 18);
    ctx.save(); ctx.globalAlpha *= ap;
    shearRect(ctx, x, y, w, panelH, -0.12); ctx.save(); ctx.clip();
    const img = IMG[s.img];
    if (img) ctx.drawImage(blurred(img, 2), x - 100, y - 200, w + 200, (w + 200) * (H / W));
    const g = ctx.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, 'rgba(10,10,14,0.35)'); g.addColorStop(0.55, 'rgba(10,10,14,0.88)'); g.addColorStop(1, 'rgba(10,10,14,0.95)');
    ctx.fillStyle = g; ctx.fillRect(x - 200, y, w + 400, panelH);
    ctx.restore();
    if (isSel && sel > 0) { ctx.strokeStyle = `rgba(255,102,170,${sel})`; ctx.lineWidth = 3; shearRect(ctx, x, y, w, panelH, -0.12); ctx.stroke(); }
    text(ctx, s.title, x + 40, y + panelH * 0.46, { size: 32, weight: 700, shadow: { color: 'rgba(0,0,0,0.5)', blur: 6 } });
    text(ctx, s.artist, x + 40, y + panelH * 0.8, { size: 22, weight: 500, color: '#e6e6e6' });
    let px = x + 380;
    s.diffs.forEach(([, sr]) => { disc(ctx, px, y + panelH * 0.66, 8, starColour(sr)); px += 22; });
    ctx.restore();
    y += panelH + gap;
    if (isSel && sel > 0.01) {
      s.diffs.forEach(([name, sr], j) => {
        const dk = ease.outQuint(inv(SS.select + 0.1 + j * 0.05, SS.select + 0.45 + j * 0.05, t));
        const dx = x0 + 60 - (j === 2 ? 50 * ease.outQuint(inv(SS.diff, SS.diff + 0.3, t)) : 0);
        ctx.save(); ctx.globalAlpha *= dk * ap;
        shearRect(ctx, dx, y, w - 60, diffH, -0.12); ctx.fillStyle = j === 2 && t > SS.diff ? 'rgba(58,44,72,0.96)' : 'rgba(30,28,38,0.92)'; ctx.fill();
        ctx.fillStyle = rgba(starColour(sr)); ctx.fillRect(dx + 6, y + 8, 7, diffH - 16);
        starPill(ctx, dx + 34, y + diffH / 2 - 13, sr, 26);
        text(ctx, name, dx + 170, y + diffH / 2 + 1, { size: 24, weight: 700, baseline: 'middle' });
        text(ctx, 'mapped by ' + (j === 2 ? 'a fan' : s.mapper), dx + 190 + measure(ctx, name, 24, 700), y + diffH / 2 + 2, { size: 19, weight: 500, baseline: 'middle', color: '#bbb' });
        ctx.restore();
        y += (diffH + gap) * dk;
      });
    }
  });
}

function sSongSelect(ctx, t) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const inA = ease.outQuint(inv(SS.t0 - 0.2, SS.t0 + 0.3, t)), sel = inv(SS.select, SS.select + 0.4, t);
  background(ctx, IMG.welcomeBg, 1 - sel, { blur: 14, dim: 0.45 });
  background(ctx, IMG.circlesBg, sel, { blur: 14, dim: 0.35 });
  // metadata wedge (top left)
  const wk = ease.outQuint(inv(SS.t0 + 0.1, SS.t0 + 0.6, t));
  ctx.save(); ctx.translate(-700 * (1 - wk), 0);
  shearRect(ctx, -60, 80, 880, 300, -0.14); ctx.fillStyle = 'rgba(20,18,26,0.82)'; ctx.fill();
  const swap = inv(SS.select, SS.select + 0.25, t), cur = swap < 0.5 ? SETS[3] : SETS[1], ta = Math.abs(swap - 0.5) * 2;
  const isC = cur === SETS[1], tribute = isC && t > SS.diff;
  text(ctx, cur.title, 70, 162, { size: 54, weight: 700, alpha: ta });
  text(ctx, cur.artist, 70, 206, { size: 30, weight: 500, alpha: ta, color: '#ddd' });
  let sx = 70;
  (isC ? [['play', '2:19'], ['clock', '184 bpm'], ['heart', '7,270']] : [['play', '0:48'], ['clock', '120 bpm'], ['heart', '1,727']]).forEach(([ic, v]) => {
    icon(ctx, ic, sx + 10, 248, 22, '#ccc'); text(ctx, v, sx + 28, 256, { size: 22, weight: 600, color: '#ccc', alpha: ta }); sx += 60 + measure(ctx, v, 22, 600);
  });
  const pw = starPill(ctx, 70, 290, isC ? (tribute ? 5.27 : 1.84) : 1.52, 30, ta);
  text(ctx, isC ? (tribute ? 'Tribute' : 'Easy') : 'Normal', 84 + pw, 314, { size: 26, weight: 700, alpha: ta });
  text(ctx, 'mapped by ' + (tribute ? 'a fan' : 'peppy'), 84 + pw + 120, 314, { size: 22, weight: 500, color: '#bbb', alpha: ta });
  (tribute ? [['Circle Size', 4], ['HP Drain', 6], ['Accuracy', 8], ['Approach Rate', 9]] : [['Circle Size', 4], ['HP Drain', 4], ['Accuracy', 5], ['Approach Rate', 5]]).forEach(([n, v], i) => {
    const ax = 70 + i * 190;
    text(ctx, n, ax, 352, { size: 17, weight: 600, color: '#aaa' });
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; roundRect(ctx, ax, 362, 160, 6, 3); ctx.fill();
    ctx.fillStyle = '#fff'; roundRect(ctx, ax, 362, 160 * (v / 10), 6, 3); ctx.fill();
  });
  ctx.restore();
  // leaderboard
  const lk = ease.outQuint(inv(SS.t0 + 0.25, SS.t0 + 0.75, t));
  ctx.save(); ctx.globalAlpha *= lk; ctx.translate(-300 * (1 - lk), 0);
  shearRect(ctx, -60, 400, 820, 520, -0.04); ctx.fillStyle = 'rgba(20,18,26,0.6)'; ctx.fill();
  text(ctx, 'Details', 70, 448, { size: 22, weight: 600, color: '#888' }); text(ctx, 'Ranking', 170, 448, { size: 22, weight: 700 });
  ctx.fillStyle = PAL.pink; ctx.fillRect(170, 458, 84, 3);
  text(ctx, 'Local', 690, 448, { size: 20, weight: 600, align: 'right', color: '#bbb' });
  icon(ctx, 'solo', 400, 660, 90, 'rgba(255,255,255,0.18)');
  text(ctx, 'No records yet!', 400, 750, { size: 26, weight: 600, align: 'center', color: '#999' });
  ctx.restore();
  // filter control (top right)
  const fk = ease.outQuint(inv(SS.t0 + 0.05, SS.t0 + 0.55, t));
  ctx.save(); ctx.globalAlpha *= fk; ctx.translate(500 * (1 - fk), 0);
  shearRect(ctx, 1080, 80, 900, 120, -0.1); ctx.fillStyle = 'rgba(20,18,26,0.85)'; ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; roundRect(ctx, 1100, 96, 760, 44, 8); ctx.fill();
  icon(ctx, 'search', 1126, 118, 22, '#aaa'); text(ctx, 'type to search', 1150, 126, { size: 21, weight: 500, color: '#888' });
  const sg = ctx.createLinearGradient(1100, 0, 1480, 0); STAR_SPEC.slice(1, 10).forEach(([, c], i) => sg.addColorStop(i / 8, c));
  ctx.fillStyle = sg; roundRect(ctx, 1100, 158, 380, 10, 5); ctx.fill();
  text(ctx, 'Sort  Title', 1530, 172, { size: 20, weight: 600, color: '#ccc' }); text(ctx, 'Group  None', 1700, 172, { size: 20, weight: 600, color: '#ccc' });
  ctx.restore();
  carousel(ctx, t, inA);
  // footer: back + mods / random / options, logo bottom-right
  const fy = H - 50 * UI, ft = ease.outQuint(inv(SS.t0, SS.t0 + 0.5, t));
  ctx.save(); ctx.translate(0, (1 - ft) * 120);
  ctx.fillStyle = 'rgba(16,14,20,0.92)'; ctx.fillRect(0, fy, W, 50 * UI);
  shearRect(ctx, -20, fy + 8, 190, 50 * UI - 16, -0.2); ctx.fillStyle = '#EB4C93'; ctx.fill();
  icon(ctx, 'back', 50, fy + 35, 30); text(ctx, 'back', 76, fy + 43, { size: 22, weight: 700 });
  ['mods', 'random', 'options'].forEach((n, i) => {
    const bx = 220 + i * 170; shearRect(ctx, bx, fy + 8, 150, 50 * UI - 16, -0.2); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    ctx.fillStyle = [PAL.yellow, PAL.green, PAL.blue][i]; ctx.fillRect(bx + 12, fy + 10, 120, 3);
    text(ctx, n, bx + 72, fy + 44, { size: 21, weight: 600, align: 'center' });
  });
  ctx.restore();
  // the logo is the play button: it arrives from the menu, then flashes and swells when clicked
  const go = t >= SS.go ? ease.outElastic(inv(SS.go, SS.go + 0.5, t)) : 0;
  drawLogo(ctx, W - 110, H - 70, 120 * lerp(1, 1.12, go), t, { visual: 0.35, flash: t >= SS.go ? 0.4 * (1 - ease.outExpo(inv(SS.go, SS.go + 1, t))) : 0, alpha: inv(M.clickSolo + 0.62, M.clickSolo + 0.72, t) });
  drawMenuCursor(ctx, ssCursor, t, 1 - inv(SS.go + 0.2, SS.go + 0.4, t));
}

// ---------- scene 4: player loader ----------
const LOADER_END = CB(-1, 2);
function loadingSpinner(ctx, x, y, s, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(t * 4.2);
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; roundRect(ctx, -s, -s, 2 * s, 2 * s, s * 0.35); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, s * 0.55, 0, PI * 1.3 + Math.sin(t * 3) * 0.6); ctx.stroke(); ctx.restore();
}
function sLoader(ctx, t) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const t0 = SS.go + 0.3, a = ease.outQuint(inv(t0, t0 + 0.5, t)), out = inv(LOADER_END - 0.5, LOADER_END, t);
  background(ctx, IMG.circlesBg, 1, { blur: 6, dim: 0.55 + 0.15 * out });
  ctx.save(); ctx.globalAlpha *= a * (1 - out); const sc = lerp(0.9, 1, ease.outQuint(inv(t0, t0 + 0.6, t))) * (1 + 0.05 * out); ctx.translate(CX, CY - 10); ctx.scale(sc, sc);
  text(ctx, 'circles!', 0, -250, { size: 64, weight: 700, align: 'center', shadow: { color: 'rgba(0,0,0,0.5)', blur: 10 } });
  text(ctx, 'nekodex', 0, -200, { size: 36, weight: 500, align: 'center', color: '#e6e6e6' });
  ctx.save(); roundRect(ctx, -270, -165, 540, 300, 18); ctx.clip(); if (IMG.circlesBg) ctx.drawImage(IMG.circlesBg, -270, -165, 540, 304); ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 2; roundRect(ctx, -270, -165, 540, 300, 18); ctx.stroke();
  loadingSpinner(ctx, 0, -15, 34, t);
  const pw = starPill(ctx, -150, 165, 5.27, 30);
  text(ctx, 'Tribute', -136 + pw, 189, { size: 28, weight: 700 });
  text(ctx, 'mapped by', -6, 240, { size: 22, weight: 500, align: 'right', color: '#bbb' });
  text(ctx, 'a fan', 4, 240, { size: 22, weight: 700 });
  ctx.restore();
  ctx.save(); ctx.globalAlpha *= a * (1 - out);
  ['visual settings', 'audio settings'].forEach((n, i) => { ctx.fillStyle = 'rgba(20,18,26,0.8)'; roundRect(ctx, W - 360, 180 + i * 70, 320, 56, 10); ctx.fill(); text(ctx, n, W - 340, 216 + i * 70, { size: 22, weight: 600 }); });
  ctx.restore();
}

// ---------- scene 5: gameplay on "circles!" ----------
const PF = { s: 2.2 };
PF.ox = (W - 512 * PF.s) / 2; PF.oy = (H - 384 * PF.s) / 2 + 12;
const P = (x, y) => ({ x: PF.ox + x * PF.s, y: PF.oy + y * PF.s });
const CS4 = 32 * (1 - (0.7 * (4 - 5)) / 5) * PF.s; // circle size 4
const game = new Beatmap({ r: CS4, preempt: 0.6, fadeIn: 0.4, sc: PF.s, seed: 23, judgeGap: 0.15 });
(function buildMap() {
  const B = TRACKS.circles.beat;
  const add = (bar, beat, x, y, nc, sound) => { const p = P(x, y); game.circle(CB(bar, beat), p.x, p.y, { nc, sound: sound || (Math.abs((beat % 2) - 1) < 1e-6 ? 'clap' : 'normal') }); };
  // tutorial: half notes, quarters, sliders, a spinner
  add(0, 0, 140, 200, true, 'finish'); add(0, 2, 372, 200);
  add(1, 0, 256, 80); add(1, 2, 256, 310);
  add(2, 0, 120, 300, true); add(2, 1, 200, 120); add(2, 2, 312, 120); add(2, 3, 392, 300);
  game.slider(CB(3, 0), [P(90, 210), P(190, 110), P(320, 270), P(424, 170)], { span: 2 * B, repeats: 1, nc: true, tickEvery: B, sound: 'whistle' });
  game.slider(CB(4, 1), [P(400, 300), P(256, 350), P(110, 300)], { span: 2 * B, curve: 'arc' });
  add(5, 0, 130, 160, true); add(5, 1, 240, 90);
  game.slider(CB(5, 2), [P(340, 110), P(430, 230)], { span: B, curve: 'linear', sound: 'clap' });
  const sc = P(256, 192); game.spinner(CB(6, 0), CB(7, 2), sc.x, sc.y, 160 * PF.s, { need: 7, ramp: 0.45 });
  add(7, 3, 256, 192, true);
  // kiai: bars 8-15
  for (let i = 0; i < 16; i++) { const a = -PI / 2 + i * (TAU / 3) + i * 0.17; add(8 + Math.floor(i / 8), (i % 8) * 0.5, 256 + Math.cos(a) * 190, 192 + Math.sin(a) * 150, i % 4 === 0, i === 0 ? 'finish' : null); }
  for (let i = 0; i < 8; i++) { const a = -PI / 2 + ((i * 2) % 5) * (TAU / 5) + (i >= 5 ? 0.6 : 0); add(10, i * 0.5, 256 + Math.cos(a) * 185, 196 + Math.sin(a) * 150, i % 4 === 0); }
  game.slider(CB(11, 0), [P(430, 300), P(330, 350), P(230, 300)], { span: B, curve: 'arc', nc: true, sound: 'whistle' });
  game.slider(CB(11, 1), [P(90, 170), P(180, 70), P(300, 90)], { span: B, curve: 'arc', sound: 'clap' });
  [[420, 220], [300, 300], [170, 240], [256, 130]].forEach(([x, y], i) => add(11, 2 + i * 0.5, x, y, i === 0));
  for (let i = 0; i < 16; i++) { const k = i / 15; add(12, i * 0.25, lerp(60, 452, k), 210 + Math.sin(k * TAU) * 115, i === 0, i % 4 === 0 ? 'whistle' : 'normal'); }
  [[60, 60], [452, 330], [452, 60], [60, 330], [256, 40], [256, 350], [70, 192], [442, 192]].forEach(([x, y], i) => add(13, i * 0.5, x, y, i % 4 === 0));
  [0, 0.5, 0.75, 1, 1.5, 2, 2.5, 2.75, 3, 3.5].forEach((b, i) => { const a = i * 1.1; add(14, b, 256 + Math.cos(a) * 170, 192 + Math.sin(a) * 135, i % 5 === 0); });
  for (let i = 0; i < 12; i++) { const k = i / 11, a = PI + k * TAU * 1.1; add(15, i * 0.25, 256 + Math.cos(a) * lerp(190, 60, k), 192 + Math.sin(a) * lerp(150, 50, k), i === 0); }
  add(15, 3.25, 120, 80); add(15, 3.5, 392, 80);
  add(16, 0, 256, 192, true, 'finish');
})();
game.finalize();
const gameCursor = game.cursor(new CursorPath()).point(LOADER_END, CX, CY + 60).point(CB(16, 2), CX + 40, CY + 120).done();
const KIAI_START = CB(8);
cue(KIAI_START, 'sample', { name: 'Gameplay/Argon/fountain-shoot', vol: 0.8 });

// lazer standardised scoring (1,000,000 max) for an all-GREAT play
const SCORE = (() => {
  const evs = game.events, n = evs.length, pts = [];
  let comboPart = 0, maxComboPart = 0;
  evs.forEach((e, i) => { maxComboPart += Math.sqrt(i + 1); });
  evs.forEach((e, i) => { comboPart += Math.sqrt(i + 1); pts.push([e.t, Math.round(500000 * ((i + 1) / n) + 500000 * (comboPart / maxComboPart))]); });
  return t => { let s = 0; for (const [tt, v] of pts) { if (tt <= t) s = v; else break; } return s; };
})();
const MAX_COMBO = game.events.length, N_GREAT = game.objs.length;

// argon counter digits (official segmented-display textures with a dim wireframe behind)
function argonDigits(ctx, str, x, y, h, o = {}) {
  const { align = 'left', wire = 0.25, wireTemplate = null, alpha = 1 } = o;
  const glyphW = ch => ((ch === '.' ? 52 : 240) / 240) * h, adv = ch => glyphW(ch) - (2 / 30) * h;
  const tpl = wireTemplate || str.replace(/[0-9x%]/g, '#');
  const tw2 = s => [...s].reduce((acc, ch) => acc + adv(ch === '#' ? '0' : ch), 0);
  const total = tw2(tpl);
  const x0 = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
  ctx.save(); ctx.globalAlpha *= alpha;
  if (wire > 0 && IMG.argon.wireframes) {
    ctx.globalAlpha = alpha * wire; let wx = x0;
    for (const ch of tpl) { if (ch !== '.') ctx.drawImage(IMG.argon.wireframes, wx, y, h, h); wx += adv(ch === '#' ? '0' : ch); }
    ctx.globalAlpha = alpha;
  }
  let tx = x0 + tw2(tpl.slice(0, Math.max(0, tpl.length - str.length)));
  for (const ch of str) {
    const img = IMG.argon[ch === '.' ? 'dot' : ch === '%' ? 'percentage' : ch];
    if (img) ctx.drawImage(img, tx, y, glyphW(ch), h);
    tx += adv(ch);
  }
  ctx.restore();
  return total;
}

function argonHud(ctx, t, a) {
  if (a <= 0) return;
  const S = UI;
  ctx.save(); ctx.globalAlpha = a;
  const combo = game.comboAt(t), last = game.lastEventBefore(t);
  // wedge pieces
  for (const [ox, oy] of [[-50, 15], [-46, 20]]) {
    const g = ctx.createLinearGradient(0, oy * S, 0, (oy + 72) * S); g.addColorStop(0, 'rgba(102,204,255,0)'); g.addColorStop(1, 'rgba(102,204,255,0.25)');
    ctx.fillStyle = g; shearRect(ctx, ox * S, oy * S, 380 * S, 72 * S, -0.8); ctx.fill();
  }
  // health bar: white path with a cyan glow, curving in at the left
  const hp = clamp(0.55 + 0.45 * (1 - Math.exp(-combo / 10)) - 0.02 * noise1(t * 0.8));
  const hx = 50 * S, hy = 30 * S, hw = 300 * S, curve = 40 * S;
  const hpPath = frac => { ctx.beginPath(); ctx.moveTo(hx, hy + 22 * S); ctx.quadraticCurveTo(hx + curve * 0.4, hy, hx + curve, hy); ctx.lineTo(hx + curve + (hw - curve) * Math.max(0.001, frac), hy); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 20 * S; hpPath(1); ctx.stroke();
  ctx.save(); ctx.shadowColor = 'rgba(126,215,253,0.85)'; ctx.shadowBlur = 24; ctx.strokeStyle = '#fff'; ctx.lineWidth = 12 * S; hpPath(hp); ctx.stroke(); ctx.restore();
  ctx.fillStyle = '#fff'; roundRect(ctx, 0, hy - 1.5 * S, 45 * S, 3 * S, 1.5 * S); ctx.fill();
  // score (8 digits)
  argonDigits(ctx, String(SCORE(t)).padStart(8, '0'), 250 * S, 52 * S, 30 * S, { align: 'right' });
  // accuracy (top right): 100 + .00 at half size + %
  const ax = W - 20 * S, ay = 20 * S, dh = 30 * S;
  const pctW = argonDigits(ctx, '%', ax, ay, dh, { align: 'right', wireTemplate: '#' });
  const fracW = argonDigits(ctx, '.00', ax - pctW, ay + dh * 0.5, dh * 0.5, { align: 'right', wireTemplate: '.##' });
  argonDigits(ctx, '100', ax - pctW - fracW, ay, dh, { align: 'right', wireTemplate: '###' });
  // performance points
  const pp = Math.round(727 * Math.pow(inv(CB(0), CB(16), t), 1.3));
  text(ctx, 'PP', ax, ay + dh + 30 * S, { size: 12 * S, weight: 700, align: 'right', color: PAL.blue, spacing: 1 });
  argonDigits(ctx, String(pp), ax - 24 * S, ay + dh + 12 * S, dh * 0.8, { align: 'right', wireTemplate: '###' });
  // combo (bottom left, scale 1.3) with label; bumps on increase
  const since = last ? t - last.t : 9, bump = lerp(1.1, 1, ease.outQuint(inv(0, 0.25, since))), ch = 30 * S * 1.3;
  text(ctx, 'COMBO', 36 * S, H - 66 * S - ch - 6, { size: 12 * S * 1.3, weight: 700, color: PAL.blue, spacing: 1 });
  ctx.save(); ctx.translate(36 * S, H - 66 * S - ch); ctx.scale(bump, bump);
  argonDigits(ctx, combo + 'x', 0, 0, ch, { wireTemplate: '#'.repeat(Math.max(3, String(combo).length + 1)) });
  ctx.restore();
  // song progress: density graph + bar + times
  const px0 = W * 0.05, pw = W * 0.9, py = H - 18 * S, prog = inv(CB(0), CB(16), t);
  for (let i = 0; i < 90; i++) {
    const t0 = lerp(CB(0), CB(16), i / 90), t1 = lerp(CB(0), CB(16), (i + 1) / 90);
    const n = game.objs.filter(o => o.t >= t0 && o.t < t1).length, bh = Math.min(26 * S, n * 7 * S);
    ctx.fillStyle = i / 90 < prog ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)';
    if (bh > 0 && i > 3 && i < 86) ctx.fillRect(px0 + (i / 90) * pw, py - 6 - bh, pw / 90 - 2, bh);
  }
  ctx.fillStyle = 'rgba(51,51,51,0.9)'; roundRect(ctx, px0, py, pw, 7, 4); ctx.fill();
  ctx.fillStyle = 'rgb(230,230,230)'; roundRect(ctx, px0, py, Math.max(7, pw * prog), 7, 4); ctx.fill();
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  text(ctx, fmt(Math.max(0, t - CB(0))), px0, py - 8, { size: 18, weight: 700 });
  text(ctx, '-' + fmt(Math.max(0, CB(16) - t)), px0 + pw, py - 8, { size: 18, weight: 700, align: 'right' });
  // key counter (bottom right)
  ['K1', 'K2', 'M1', 'M2'].forEach((k, i) => {
    const kx = W - 36 * S - (4 - i) * 40 * S, ky = H - 104 * S;
    const pressed = i < 2 && game.hits.some(h => h.key === i && t >= h.t && t <= h.t + h.dur);
    const count = i < 2 ? game.hits.filter(h => h.key === i && h.t <= t).length : 0;
    ctx.fillStyle = pressed ? '#ffffff' : 'rgba(255,255,255,0.25)'; roundRect(ctx, kx, ky, 34 * S, 4 * S, 2 * S); ctx.fill();
    text(ctx, k, kx + 17 * S, ky + 18 * S, { size: 11 * S, weight: 700, align: 'center', color: pressed ? '#fff' : '#bbb' });
    text(ctx, String(count), kx + 17 * S, ky + 36 * S, { size: 14 * S, weight: 600, align: 'center' });
  });
  // bar hit error meters on both edges
  for (const side of [0, 1]) {
    const mx = side ? W - 14 * S : 14 * S, my = CY, mh = 300;
    for (const [f, c] of [[1, HIT.meh], [0.62, HIT.ok], [0.3, HIT.great]]) { ctx.fillStyle = rgba(c, 0.8); ctx.fillRect(mx - 3, my - (mh / 2) * f, 6, mh * f); }
    for (const h of game.hits) {
      const dt = t - h.t; if (dt < 0 || dt > 3) continue;
      ctx.fillStyle = rgba(HIT.great, 0.9 * (1 - dt / 3)); ctx.fillRect(side ? mx - 22 : mx + 6, my + (h.o.err / 0.08) * (mh / 2) - 1.5, 16, 3);
    }
  }
  ctx.restore();
}

// kiai star fountains (official fountain-star texture)
function kiaiFountain(ctx, t, t0, seed) {
  const dt = t - t0; if (dt < 0 || dt > 2.4 || !IMG.star) return;
  const r = rng(seed);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let side = 0; side < 2; side++) for (let i = 0; i < 46; i++) {
    const delay = r() * 0.6, life = lerp(1.0, 1.6, r()), vx = lerp(120, 560, r()) * (side ? -1 : 1), vy = -lerp(900, 1600, r()), sp = lerp(-6, 6, r()), s = lerp(18, 34, r());
    const tt = dt - delay; if (tt < 0 || tt > life) continue;
    ctx.globalAlpha = 1 - ease.inQuad(tt / life);
    ctx.save(); ctx.translate((side ? W + 10 : -10) + vx * tt, H + 30 + vy * tt + 0.5 * 1400 * tt * tt); ctx.rotate(sp * tt); ctx.drawImage(IMG.star, -s / 2, -s / 2, s, s); ctx.restore();
  }
  ctx.restore();
}

function sGameplay(ctx, t) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const inA = ease.outQuint(inv(LOADER_END - 0.4, LOADER_END + 0.3, t)), bi = beatInfo(t);
  background(ctx, IMG.circlesBg, inA, { dim: 0.68 - (bi.kiai ? 0.06 * Math.exp(-bi.since * 6) : 0), zoom: 1.03 });
  if (bi.kiai && bi.idx % 4 === 0 && bi.since < 0.3) { ctx.fillStyle = `rgba(255,255,255,${0.05 * (1 - bi.since / 0.3)})`; ctx.fillRect(0, 0, W, H); }
  kiaiFountain(ctx, t, KIAI_START, 3);
  game.draw(ctx, t, { alpha: inA });
  // tutorial callouts
  const o0 = game.objs[0];
  const c1 = win(t, CB(-1, 2), CB(-1, 3), CB(0) - 0.05, CB(0, 0.5));
  if (c1 > 0) {
    const rr = game.r * lerp(4, 1, inv(o0.t - game.preempt, o0.t, t)) * 0.97;
    callout(ctx, 'approach circle', o0.x + Math.cos(-2.3) * rr, o0.y + Math.sin(-2.3) * rr, o0.x - 120, o0.y - 250, c1);
    callout(ctx, 'hit circle', o0.x + 40, o0.y + 50, o0.x + 140, o0.y + 210, c1);
  }
  const sl = game.objs.find(o => o.type === 'slider');
  const c2 = win(t, CB(3, 0.2), CB(3, 0.8), CB(3, 3.6), CB(4, 0.2));
  if (c2 > 0) {
    const b = game.ballAt(sl, t);
    callout(ctx, 'slider ball', b.x + 20, b.y + 40, 820, 860, c2, PAL.blue);
    callout(ctx, 'follow circle', b.x + 110, b.y - 140, 1320, 230, c2, PAL.blue);
    if (t < CB(3, 2)) { const e = sl.path.at(sl.path.len); callout(ctx, 'repeat', e.x + 30, e.y - 30, e.x + 120, e.y - 160, c2 * (1 - inv(CB(3, 1.7), CB(3, 2), t)), PAL.blue); }
  }
  const sp = game.objs.find(o => o.type === 'spinner');
  const c3 = win(t, CB(6, 0.2), CB(6, 1), CB(7, 1), CB(7, 1.8));
  if (c3 > 0) callout(ctx, 'spin until it fills', sp.x + sp.R * 0.72, sp.y - sp.R * 0.72, sp.x + sp.R + 60, sp.y - sp.R + 10, c3, PAL.yellow);
  drawGameCursor(ctx, gameCursor, t, { alpha: inA });
  argonHud(ctx, t, inA);
}

// ---------- scene 6: results (ResultsScreen / expanded ScorePanel) ----------
const RES = { t0: CB(16, 0.6) };
RES.fill0 = RES.t0 + 0.45;            // ACCURACY_TRANSFORM_DELAY
RES.rank = CB(17, 2);                 // the rank lands on a beat
RES.stats = CB(20);
cue(RES.t0, 'sample', { name: 'Results/score-panel-top-appear' });
cue(RES.t0 + 0.443, 'sample', { name: 'Results/swoosh-up', vol: 0.4 });
for (let i = 0; i < 26; i++) { const k = i / 26; cue(RES.fill0 + ease.inQuad(k) * (RES.rank - RES.fill0 - 0.1), 'sample', { name: 'Results/score-tick', vol: lerp(0.6, 1, k), rate: 1 + k }); }
[0, 1, 2, 3].forEach(i => cue(RES.fill0 + 0.08 + i * 0.07, 'sample', { name: 'Results/badge-dink', vol: 0.8, rate: 1 + i * 0.06 }));
cue(RES.fill0 + 0.42, 'sample', { name: 'Results/badge-dink-max', vol: 0.9 });
cue(RES.rank, 'sample', { name: 'Results/rank-impact-pass-ss' });
cue(RES.rank + 0.545, 'sample', { name: 'Results/applause-s', vol: 0.9 });
cue(RES.stats, 'sample', { name: 'UI/overlay-big-pop-in', vol: 0.6 });
const GRADES = [[0, 0.7, RANK.D], [0.7, 0.8, RANK.C], [0.8, 0.9, RANK.B], [0.9, 0.95, RANK.A], [0.95, 0.99, RANK.S], [0.99, 1, RANK.X]];

function accuracyCircle(ctx, x, y, R, t) {
  const appear = ease.outQuint(inv(RES.t0, RES.t0 + 0.2, t));
  ctx.save(); ctx.translate(x, y); ctx.scale(appear, appear);
  arc(ctx, 0, 0, R * 0.895, -PI / 2, PI * 1.5, R * 0.21, rgba(gray(47)));
  const fill = ease.outPow10(inv(RES.fill0, RES.fill0 + 3, t));
  const g = ctx.createLinearGradient(0, -R, 0, R); g.addColorStop(0, '#7CF6FF'); g.addColorStop(1, '#BAFFA9');
  if (fill > 0) arc(ctx, 0, 0, R * 0.9, -PI / 2, -PI / 2 + TAU * Math.min(fill, 0.9999), R * 0.2, g);
  const gp = ease.outPow10(inv(RES.t0 + 0.15, RES.t0 + 0.95, t)), gr = R * 0.8;
  GRADES.forEach(([a0, a1, c]) => { const s0 = a0 + 1 / 360, s1 = Math.min(a1 - 1 / 360, gp); if (s1 > s0) arc(ctx, 0, 0, gr - gr * 0.025, -PI / 2 + s0 * TAU, -PI / 2 + s1 * TAU, gr * 0.05, c); });
  [['D', 0.0], ['C', 0.7], ['B', 0.8], ['A', 0.9], ['S', 0.95], ['X', 1.0]].forEach(([k, acc]) => {
    const ang = -PI / 2 + acc * TAU + (k === 'D' ? 0.12 : k === 'X' ? -0.12 : 0), bx = Math.cos(ang) * R * 1.13, by = Math.sin(ang) * R * 1.13;
    const lit = fill >= acc - 0.001 && t > RES.fill0, bw = 28 * UI, bh = 14 * UI;
    ctx.save(); ctx.translate(bx, by);
    ctx.fillStyle = lit ? RANK[k] : rgba(toRgb(RANK[k]), 0.2); roundRect(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fill();
    if (lit) glow(ctx, 0, 0, 30, RANK[k], 0.5);
    text(ctx, k === 'X' ? 'SS' : k, 0, 1, { size: 10 * UI, family: FONT_RANK, align: 'center', baseline: 'middle', weight: 400, color: lit ? '#fff' : 'rgba(255,255,255,0.5)' });
    ctx.restore();
  });
  const rk = inv(RES.rank, RES.rank + 0.2, t);
  if (rk > 0) {
    glow(ctx, 0, 0, R * 1.3, RANK.X, 0.55 * (1 - inv(RES.rank, RES.rank + 1.2, t)) + 0.18);
    const s = lerp(1.05, 1, ease.outQuint(inv(RES.rank, RES.rank + 3, t)));
    ctx.save(); ctx.translate(0, (1 - ease.outBounce(rk)) * -20); ctx.scale(s, s);
    text(ctx, 'SS', 0, 4, { size: 64 * UI, weight: 400, family: FONT_RANK, align: 'center', baseline: 'middle', spacing: -6, color: '#fff', shadow: { color: rgba(RANK.X, 0.95), blur: 30 } });
    ctx.restore();
    disc(ctx, 0, 0, R * 0.6, '#ffffff', 0.8 * (1 - ease.outQuint(inv(RES.rank, RES.rank + 0.4, t))));
  }
  ctx.restore();
}

function scorePanel(ctx, t, x, y) {
  const pw = 360 * UI, ph = 586 * UI, top = 53 * UI, k = ease.outQuint(inv(RES.t0, RES.t0 + 0.5, t));
  ctx.save(); ctx.translate(x, y + (1 - k) * 80); ctx.globalAlpha *= k;
  let g = ctx.createLinearGradient(0, -ph / 2, 0, ph / 2); g.addColorStop(0, '#555'); g.addColorStop(1, '#333');
  ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 30; ctx.fillStyle = g; roundRect(ctx, -pw / 2, -ph / 2, pw, ph, 20); ctx.fill(); ctx.shadowColor = 'transparent';
  g = ctx.createLinearGradient(0, -ph / 2, 0, -ph / 2 + top); g.addColorStop(0, '#444'); g.addColorStop(1, '#333');
  ctx.fillStyle = g; roundRect(ctx, -pw / 2, -ph / 2, pw, top, [20, 20, 0, 0]); ctx.fill();
  const yT = -ph / 2;
  disc(ctx, 0, yT - 4, 45, '#2b2240'); ring(ctx, 0, yT - 4, 45, 4, '#fff', 0.9);
  icon(ctx, 'solo', 0, yT + 4, 66, PAL.purpleLight);
  text(ctx, 'Guest', 0, yT + 64, { size: 22, weight: 600, align: 'center' });
  text(ctx, 'circles!', 0, yT + 122, { size: 20 * UI, weight: 600, align: 'center' });
  text(ctx, 'nekodex', 0, yT + 152, { size: 16 * UI, weight: 500, align: 'center', color: '#ddd' });
  const pwid = starPill(ctx, -150, yT + 168, 5.27, 24);
  text(ctx, 'Tribute', -150 + pwid + 10, yT + 187, { size: 18, weight: 700 });
  text(ctx, 'mapped by a fan', 150, yT + 187, { size: 16, weight: 500, align: 'right', color: '#bbb' });
  accuracyCircle(ctx, 0, yT + 362, 128, t);
  const total = Math.round(1000000 * ease.outQuint(inv(RES.fill0, RES.fill0 + 1.6, t))).toLocaleString('en-US');
  text(ctx, total, 0, yT + 578, { size: 34 * UI, weight: 300, align: 'center', spacing: 2 });
  ctx.globalAlpha *= ease.outQuint(inv(RES.rank - 0.2, RES.rank + 0.4, t));
  [['ACCURACY', '100.00%'], ['MAX COMBO', MAX_COMBO + 'x'], ['PP', '727']].forEach(([l, v], i) => {
    const cx = -pw / 2 + (pw * (i + 0.5)) / 3;
    text(ctx, l, cx, yT + 622, { size: 12 * UI, weight: 700, align: 'center', color: '#aaa', spacing: 1 });
    text(ctx, v, cx, yT + 656, { size: 20 * UI, weight: 400, align: 'center' });
  });
  [['GREAT', N_GREAT, HIT.great], ['OK', 0, HIT.ok], ['MEH', 0, HIT.meh], ['MISS', 0, HIT.miss]].forEach(([l, v, c], i) => {
    const cx = -pw / 2 + (pw * (i + 0.5)) / 4;
    text(ctx, l, cx, yT + 706, { size: 12 * UI, weight: 700, align: 'center', color: c, spacing: 1 });
    text(ctx, String(v), cx, yT + 740, { size: 18 * UI, weight: 400, align: 'center' });
  });
  text(ctx, 'Played on 20 Oct 2026 13:37', 0, ph / 2 - 22, { size: 16, weight: 500, align: 'center', color: '#888' });
  ctx.restore();
}

function statisticsPanel(ctx, t) {
  const k = ease.outQuint(inv(RES.stats, RES.stats + 0.6, t));
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha *= k; ctx.translate((1 - k) * 200, 0);
  const x0 = 1010, y0 = 170, w = 830, h = 700;
  ctx.fillStyle = 'rgba(30,28,36,0.85)'; roundRect(ctx, x0, y0, w, h, 20); ctx.fill();
  text(ctx, 'Timing Distribution', x0 + 40, y0 + 64, { size: 30, weight: 700 });
  const r = rng(91), bins = 41, counts = new Array(bins).fill(0);
  game.hits.forEach(hh => { const b = Math.round((hh.o.err / 0.04) * 20) + 20; if (b >= 0 && b < bins) counts[b]++; });
  for (let i = 0; i < 400; i++) { const v = (r() + r() + r() + r() - 2) * 0.55, b = Math.round(v * 12) + 20; if (b >= 0 && b < bins) counts[b] += 0.25; }
  const maxC = Math.max(...counts), hx = x0 + 60, hw = w - 120, hb = y0 + 420, hh = 300, grow = ease.outQuint(inv(RES.stats + 0.2, RES.stats + 1.0, t));
  counts.forEach((c, i) => {
    const bw = hw / bins, bh = (c / maxC) * hh * grow, d = Math.abs(i - 20);
    ctx.fillStyle = d < 7 ? PAL.blue : d < 13 ? PAL.green : PAL.yellow;
    roundRect(ctx, hx + i * bw + 2, hb - bh, bw - 4, Math.max(2, bh), 3); ctx.fill();
  });
  ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(hx + hw / 2 - 1, hb - hh - 10, 2, hh + 14);
  text(ctx, 'Early', hx, hb + 34, { size: 20, weight: 600, color: '#aaa' }); text(ctx, 'Late', hx + hw, hb + 34, { size: 20, weight: 600, align: 'right', color: '#aaa' });
  [['Unstable Rate', '72.31'], ['Average Hit Error', '-0.84ms early'], ['Max Combo', MAX_COMBO + 'x']].forEach(([l, v], i) => {
    const iy = hb + 100 + i * 50; text(ctx, l, x0 + 60, iy, { size: 24, weight: 500, color: '#ccc' }); text(ctx, v, x0 + w - 60, iy, { size: 24, weight: 700, align: 'right' });
  });
  ctx.restore();
}

function sResults(ctx, t) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  background(ctx, IMG.circlesBg, 1, { blur: 16, dim: 0.5 });
  const mv = ease.inOutQuint(inv(RES.stats - 0.1, RES.stats + 0.5, t));
  scorePanel(ctx, t, lerp(CX, 520, mv), CY + 40);
  statisticsPanel(ctx, t);
  const bk = ease.outQuint(inv(RES.t0 + 0.3, RES.t0 + 0.8, t));
  ctx.save(); ctx.globalAlpha *= bk; shearRect(ctx, -20, H - 70, 190, 54, -0.2); ctx.fillStyle = '#EB4C93'; ctx.fill(); icon(ctx, 'back', 46, H - 43, 30); text(ctx, 'back', 72, H - 35, { size: 22, weight: 700 }); ctx.restore();
  toolbar(ctx, t, 1);
}

// ---------- scene 7: back to the menu on "triangles", then exit ("see ya!") ----------
const OUT = { t0: CB(24), exit: TB(3), fade: TB(3) + 2.2 };
cue(OUT.t0, 'sample', { name: 'Menu/osu-logo-select', vol: 0.7 });
cue(OUT.exit - 0.4, 'sample', { name: 'Menu/button-hover', vol: 0.7, pan: 0.5 });
cue(OUT.exit, 'sample', { name: 'Menu/button-default-select', pan: 0.5 });
cue(OUT.exit + 0.05, 'sample', { name: 'Intro/Welcome/seeya', vol: 1.0 });
const EXIT_X = LOGO_TOP.x + LOGO_TOP.r * 0.84 + BTN_W * 3 + BTN_W * 0.55;
const outCursor = new CursorPath().point(OUT.t0, 300, 900).point(TB(2), 1400, 860).point(OUT.exit - 0.4, EXIT_X, CY + 10).point(OUT.exit, EXIT_X + 6, CY + 6).click(OUT.exit).point(OUT.exit + 1, EXIT_X + 40, CY + 120).done();

function sOutro(ctx, t) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const fadeOut = ease.inOutQuad(inv(OUT.exit + 0.6, OUT.fade, t)), enter = ease.outQuint(inv(OUT.t0, OUT.t0 + 0.5, t));
  background(ctx, IMG.menuBg1, (1 - fadeOut) * enter, { zoom: 1.02 + 0.015 * Math.sin(t * 0.4) });
  const open = 1 - ease.inQuint(inv(OUT.exit + 0.1, OUT.exit + 0.4, t));
  ctx.fillStyle = `rgba(50,50,50,${0.85 * open * enter})`; ctx.fillRect(0, CY - (BTN_H / 2) * open, W, BTN_H * open);
  buttonRow(ctx, t, MENU.top, OUT.t0 + 0.1, OUT.exit + 0.05, 4, OUT.exit - 0.4, OUT.exit);
  const back = ease.inOutQuint(inv(OUT.exit + 0.1, OUT.exit + 0.8, t));
  const lr = lerp(LOGO_TOP.r, 240, back) * (1 + 0.15 * ease.inQuad(inv(OUT.exit + 0.8, OUT.fade, t)));
  drawLogo(ctx, lerp(LOGO_TOP.x, CX, back), CY, lr, t, { alpha: (1 - fadeOut) * ease.outQuint(inv(OUT.t0 - 0.3, OUT.t0 + 0.3, t)), visual: 0.5 });
  toolbar(ctx, t, enter * (1 - inv(OUT.exit, OUT.exit + 0.4, t)));
  songTicker(ctx, t, OUT.t0 + 0.3, 'triangles', 'cYsmix', 3.5);
  // menu tip line (MenuTipDisplay) carries the tagline
  const tip = win(t, TB(0, 2), TB(1), OUT.exit, OUT.exit + 0.4);
  if (tip > 0) {
    ctx.save(); ctx.globalAlpha *= tip;
    const a = 'rhythm is just a ', b = 'click', c = ' away  ·  osu.ppy.sh';
    const wa = measure(ctx, a, 28, 500), wb = measure(ctx, b, 28, 700), wc = measure(ctx, c, 28, 500), x0 = CX - (wa + wb + wc) / 2;
    ctx.fillStyle = 'rgba(20,18,26,0.75)'; roundRect(ctx, x0 - 36, H - 150, wa + wb + wc + 72, 64, 12); ctx.fill();
    text(ctx, a, x0, H - 108, { size: 28, weight: 500 });
    text(ctx, b, x0 + wa, H - 108, { size: 28, weight: 700, color: PAL.pink });
    text(ctx, c, x0 + wa + wb, H - 108, { size: 28, weight: 500 });
    ctx.restore();
  }
  drawMenuCursor(ctx, outCursor, t, inv(OUT.t0, OUT.t0 + 0.3, t) * (1 - inv(OUT.exit + 0.3, OUT.exit + 0.6, t)));
  // credits
  const cr = win(t, OUT.fade - 0.2, OUT.fade + 0.5, DURATION - 0.6, DURATION);
  if (cr > 0) {
    ctx.save(); ctx.globalAlpha = cr;
    const head = (s, y) => text(ctx, s, CX, y, { size: 22, weight: 700, align: 'center', color: PAL.pink, spacing: 3 });
    const line = (s, y) => text(ctx, s, CX, y, { size: 30, weight: 500, align: 'center' });
    head('music', 360); line('nekodex — welcome to osu!   ·   nekodex — circles!   ·   cYsmix — triangles', 404);
    head('voice, sounds & textures', 486); line('osu!resources by ppy Pty Ltd  ·  CC BY-NC 4.0', 530);
    head('design reference', 612); line('osu!(lazer)  ·  github.com/ppy/osu', 656);
    text(ctx, 'fan-made and non-commercial  ·  not affiliated with ppy  ·  osu.ppy.sh', CX, 780, { size: 22, weight: 500, align: 'center', color: '#999' });
    ctx.restore();
  }
}

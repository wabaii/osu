'use strict';
// Core timing, easing, colour and drawing helpers shared by every scene.

const W = 1920, H = 1080, FPS = 60;
// osu!lazer lays its UI out on a 1024x768 reference; at 1080p that is a 1.4x scale.
const UI = 1080 / 768;

// ---------- official tracks, placed on the video timeline ----------
// `start` is the video time at which the track's own time is 0; offsets/beat lengths come from
// the timing points in the official .osz files (osu-resources/osu.Game.Resources/Tracks).
const TRACKS = {
  welcome: { start: 2.142, offset: -0.040, beat: 0.5, kiai: [[0.005, 0.605]] },                 // nekodex - welcome to osu!
  circles: { start: 16.85, offset: 2.5588215380251, beat: 60 / 184, kiai: [[12.993, 23.102], [23.428, 32.558], [33.863, 53.428]] }, // nekodex - circles!
  triangles: { start: 0, offset: 3.01174006797141, beat: 0.375, kiai: [[87.011, 97.511]] },   // cYsmix - triangles
};
// beat grids in video time
const WB = (beat) => TRACKS.welcome.start + TRACKS.welcome.offset + beat * TRACKS.welcome.beat;
const CB = (bar, beat = 0) => TRACKS.circles.start + TRACKS.circles.offset + (bar * 4 + beat) * TRACKS.circles.beat;
TRACKS.triangles.start = CB(24) - TRACKS.triangles.offset; // triangles' first bar lands on circles! bar 24
const TB = (bar, beat = 0) => TRACKS.triangles.start + TRACKS.triangles.offset + (bar * 4 + beat) * TRACKS.triangles.beat;

// which track drives the beat at a given video time
function trackAt(t) {
  if (t < CB(-1)) return TRACKS.welcome;
  if (t < CB(23, 3)) return TRACKS.circles;
  return TRACKS.triangles;
}
const DURATION = TB(4) + 3.9;

const PI = Math.PI, TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, k) => a + (b - a) * k;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

const ELASTIC = TAU / 0.3;
const ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: t => 1 - Math.pow(1 - t, 4),
  inQuart: t => t * t * t * t,
  outQuint: t => 1 - Math.pow(1 - t, 5),
  inQuint: t => t ** 5,
  inOutQuint: t => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: t => t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outPow10: t => 1 - Math.pow(1 - t, 10),
  inOutSine: t => -(Math.cos(PI * t) - 1) / 2,
  outSine: t => Math.sin((t * PI) / 2),
  inSine: t => 1 - Math.cos((t * PI) / 2),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inBack: t => { const c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
  // osu!framework's elastic curves
  outElastic: t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t - 0.075) * ELASTIC) + 1,
  outElasticHalf: t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((0.5 * t - 0.075) * ELASTIC) + 1,
  outBounce: t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; },
};

const tw = (t, t0, t1, a, b, e = ease.linear) => lerp(a, b, e(inv(t0, t1, t)));
// envelope: 0 before a, rises a..b, holds, falls c..d, 0 after d
function win(t, a, b, c, d, eIn = ease.outCubic, eOut = ease.inCubic) {
  if (t < a || t > d) return 0;
  if (t < b) return eIn(inv(a, b, t));
  if (t <= c) return 1;
  return 1 - eOut(inv(c, d, t));
}

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function noise1(x) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u); }

// ---------- beat helpers (follow whichever official track is playing) ----------
function beatInfo(t) {
  const tr = trackAt(t), local = t - tr.start, rel = (local - tr.offset) / tr.beat;
  const idx = Math.floor(rel + 1e-6);
  const kiai = tr.kiai.some(([a, b]) => local >= a && local < b);
  return { len: tr.beat, idx, since: (rel - idx) * tr.beat, kiai, local, track: tr };
}
const pulse = (t, decay = 8) => Math.exp(-beatInfo(t).since * decay);
const flashAt = (t, t0, decay = 6) => (t < t0 ? 0 : Math.exp(-(t - t0) * decay));

// ---------- audio-reactive data (FFT of the final mix, written by scripts/mix_audio.py) ----------
const SPECTRUM = { bands: 0, frames: 0, data: null, amp: null };
function specAt(t, band) {
  if (!SPECTRUM.data) return 0.25 * noise1(band * 0.7 + t * 5) * pulse(t, 5);
  const f = clamp(Math.round(t * FPS), 0, SPECTRUM.frames - 1);
  return SPECTRUM.data[f * SPECTRUM.bands + (band % SPECTRUM.bands)] / 255;
}
function ampAt(t) {
  if (!SPECTRUM.amp) return 0.5 + 0.5 * pulse(t, 6);
  return SPECTRUM.amp[clamp(Math.round(t * FPS), 0, SPECTRUM.frames - 1)] / 255;
}

// ---------- colour ----------
// osu!lazer palette (osu.Game/Graphics/OsuColour.cs)
const PAL = {
  pink: '#FF66AA', pinkLight: '#FF99CC', pinkDark: '#CC5288', pinkDarker: '#BB1177',
  purple: '#8866EE', purpleLight: '#AA88FF', purpleDark: '#6644CC', purpleDarker: '#441188',
  blue: '#66CCFF', blueLight: '#99EEFF', blueDark: '#44AADD', blueDarker: '#2299BB',
  yellow: '#FFCC22', yellowDark: '#EEAA00', green: '#88B300', greenLight: '#B3D944', red: '#ED1121',
  argonPink: '#FC618F', argonPinkDark: '#BB1A41', glowCyan: '#ABFFFF',
};
// argon default combo colours (osu.Game/Skinning/ArgonSkin.cs)
const COMBO = ['#F17400', '#00F135', '#0052F1', '#F10000', '#E8EB00', '#5C00F1'];
const RANK = { X: '#DE31AE', S: '#02B5C3', A: '#88DA20', B: '#E3B130', C: '#FF8E5D', D: '#FF5A5A' };
const HIT = { great: PAL.blue, ok: PAL.green, meh: PAL.yellow, miss: PAL.red };

function hex2rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
const toRgb = c => (typeof c === 'string' ? hex2rgb(c) : c);
function rgba(c, a = 1) { const [r, g, b] = toRgb(c); return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
function mix(c1, c2, k) { const a = toRgb(c1), b = toRgb(c2); return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; }
const lighten = (c, k) => mix(c, [255, 255, 255], k);
// osu!framework Color4.Darken(amount) divides by (1 + amount)
const fwDarken = (c, amount) => toRgb(c).map(v => v / (1 + amount));
const gray = v => [v, v, v];

// ---------- canvas helpers ----------
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

const FONT_UI = "'Outfit'", FONT_RANK = "'Michroma'";
function setFont(ctx, size, weight = 600, italic = false, family = FONT_UI) {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
}

function text(ctx, s, x, y, o = {}) {
  const { size = 40, weight = 600, italic = false, align = 'left', baseline = 'alphabetic', color = '#fff',
    alpha = 1, spacing = 0, family = FONT_UI, stroke = null, strokeWidth = 2, shadow = null, blend = null } = o;
  if (alpha <= 0) return;
  ctx.save();
  setFont(ctx, size, weight, italic, family);
  ctx.textAlign = align; ctx.textBaseline = baseline;
  ctx.letterSpacing = spacing + 'px';
  ctx.globalAlpha *= alpha;
  if (blend) ctx.globalCompositeOperation = blend;
  if (shadow) { ctx.shadowColor = shadow.color; ctx.shadowBlur = shadow.blur; ctx.shadowOffsetX = shadow.x || 0; ctx.shadowOffsetY = shadow.y || 0; }
  if (color) { ctx.fillStyle = color; ctx.fillText(s, x, y); }
  if (stroke) { ctx.shadowColor = 'transparent'; ctx.strokeStyle = stroke; ctx.lineWidth = strokeWidth; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.restore();
}

function measure(ctx, s, size, weight = 600, italic = false, spacing = 0, family = FONT_UI) {
  ctx.save(); setFont(ctx, size, weight, italic, family); ctx.letterSpacing = spacing + 'px';
  const w = ctx.measureText(s).width; ctx.restore(); return w;
}

// per-letter animated text (pop in with a stagger)
function kinetic(ctx, s, x, y, t, o = {}) {
  const { size = 80, weight = 700, italic = false, align = 'left', color = '#fff', spacing = 0, family = FONT_UI,
    t0 = 0, stagger = 0.03, dur = 0.35, tOut = Infinity, outStagger = 0.015, outDur = 0.25, rise = 0.5, alpha = 1 } = o;
  if (t < t0 || alpha <= 0) return;
  ctx.save();
  setFont(ctx, size, weight, italic, family);
  ctx.letterSpacing = spacing + 'px';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const total = ctx.measureText(s).width;
  const x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const chars = [...s];
  let acc = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i], cx = x0 + ctx.measureText(acc).width;
    acc += ch;
    if (ch === ' ') continue;
    const ki = inv(t0 + i * stagger, t0 + i * stagger + dur, t);
    const ko = tOut === Infinity ? 0 : inv(tOut + i * outStagger, tOut + i * outStagger + outDur, t);
    if (ki <= 0 || ko >= 1) continue;
    const e = ease.outBack(ki), eo = ease.inCubic(ko);
    ctx.save();
    ctx.globalAlpha *= clamp(ki * 2) * (1 - eo) * alpha;
    ctx.fillStyle = color;
    ctx.fillText(ch, cx, y + (1 - e) * size * rise + eo * size * 0.4);
    ctx.restore();
  }
  ctx.restore();
}

const _glow = new Map();
function glowSprite(color) {
  const key = typeof color === 'string' ? color : color.join(',');
  if (_glow.has(key)) return _glow.get(key);
  const c = makeCanvas(256, 256), g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, rgba(color, 1)); gr.addColorStop(0.25, rgba(color, 0.55));
  gr.addColorStop(0.6, rgba(color, 0.12)); gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  _glow.set(key, c); return c;
}
function glow(ctx, x, y, r, color, alpha = 1) {
  if (alpha <= 0 || r <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(glowSprite(color), x - r, y - r, 2 * r, 2 * r); ctx.restore();
}
function ring(ctx, x, y, r, lw, color, alpha = 1) {
  if (alpha <= 0 || r <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = typeof color === 'string' ? color : rgba(color);
  ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, Math.max(0.1, r), 0, TAU); ctx.stroke(); ctx.restore();
}
function disc(ctx, x, y, r, color, alpha = 1) {
  if (alpha <= 0 || r <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = typeof color === 'string' ? color : rgba(color);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
}
function triPath(ctx, x, y, s, rot = 0) {
  const R = s / Math.sqrt(3);
  for (let i = 0; i < 3; i++) {
    const a = rot - PI / 2 + (i * TAU) / 3;
    i ? ctx.lineTo(x + R * Math.cos(a), y + R * Math.sin(a)) : ctx.moveTo(x + R * Math.cos(a), y + R * Math.sin(a));
  }
  ctx.closePath();
}
// sheared rectangle (lazer's "wedge" shape); shear is horizontal offset per pixel of height
function shearRect(ctx, x, y, w, h, shear) {
  const d = h * shear;
  ctx.beginPath(); ctx.moveTo(x + d, y); ctx.lineTo(x + w + d, y); ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath();
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

// tint a white texture with a colour (cached)
const _tint = new Map();
function tinted(img, color) {
  const key = (img.src || img.id || '') + color;
  if (_tint.has(key)) return _tint.get(key);
  const c = makeCanvas(img.width, img.height), g = c.getContext('2d');
  g.drawImage(img, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = typeof color === 'string' ? color : rgba(color); g.fillRect(0, 0, c.width, c.height);
  _tint.set(key, c); return c;
}

// lazer-style triangles (TrianglesV2: outlined, gradient tinted, drifting upwards)
class TriField {
  constructor(seed, n, o = {}) {
    const r = rng(seed);
    this.o = Object.assign({ minS: 40, maxS: 260, w: W, h: H, outline: 0 }, o);
    this.tris = [];
    for (let i = 0; i < n; i++) {
      const k = Math.pow(r(), 1.5);
      this.tris.push({ x: r() * this.o.w, y: r() * (this.o.h + 2 * this.o.maxS), s: lerp(this.o.minS, this.o.maxS, k), shade: r(), v: lerp(1.3, 0.6, k) });
    }
    this.tris.sort((a, b) => b.s - a.s);
  }
  draw(ctx, travel, colorFn, alpha = 1, ox = 0, oy = 0) {
    if (alpha <= 0) return;
    const span = this.o.h + 2 * this.o.maxS;
    ctx.save();
    for (const tr of this.tris) {
      let y = tr.y - travel * tr.v;
      y = ((y % span) + span) % span - this.o.maxS;
      const c = colorFn(tr.shade, y / this.o.h);
      ctx.globalAlpha = alpha * c[1];
      ctx.beginPath(); triPath(ctx, tr.x + ox, y + oy, tr.s);
      if (this.o.outline) { ctx.strokeStyle = c[0]; ctx.lineWidth = tr.s * this.o.outline; ctx.lineJoin = 'miter'; ctx.stroke(); }
      else { ctx.fillStyle = c[0]; ctx.fill(); }
    }
    ctx.restore();
  }
}

// cumulative scroll distance for triangle fields, kicked by beats (like lazer's velocity bumps)
function travelFn(base, kicks = []) {
  return t => {
    let d = base * t;
    for (const [t0, A, dec] of kicks) if (t > t0) d += (A / dec) * (1 - Math.exp(-dec * (t - t0)));
    return d;
  };
}

// audio cue list, consumed by scripts/mix_audio.py
const CUES = [];
function cue(t, type, o = {}) { CUES.push(Object.assign({ t: +t.toFixed(5), type }, o)); }
const panOf = x => +clamp((x / W - 0.5) * 0.8, -0.6, 0.6).toFixed(3);

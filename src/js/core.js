'use strict';
// Core timing, easing, colour and drawing helpers shared by every scene.

const W = 1920, H = 1080, FPS = 60;
const BPM = 160, BEAT = 60 / BPM, BAR = 4 * BEAT;
const T = (bar, beat = 0) => (bar * 4 + beat) * BEAT;
const DURATION = 56;

const PI = Math.PI, TAU = Math.PI * 2;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, k) => a + (b - a) * k;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

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
  inOutQuint: t => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: t => t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  inOutSine: t => -(Math.cos(PI * t) - 1) / 2,
  outSine: t => Math.sin((t * PI) / 2),
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outBackBig: t => { const c1 = 3.0, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inBack: t => { const c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
  outElastic: t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1,
};

// value from a to b while t moves t0 -> t1
const tw = (t, t0, t1, a, b, e = ease.linear) => lerp(a, b, e(inv(t0, t1, t)));
// envelope: 0 before a, rises a..b, holds, falls c..d, 0 after d
function win(t, a, b, c, d, eIn = ease.outCubic, eOut = ease.inCubic) {
  if (t < a || t > d) return 0;
  if (t < b) return eIn(inv(a, b, t));
  if (t <= c) return 1;
  return 1 - eOut(inv(c, d, t));
}

// deterministic randomness
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

// beat helpers
const beatIndex = t => Math.floor(t / BEAT + 1e-6);
const sinceBeat = t => t - beatIndex(t) * BEAT;
const pulse = (t, decay = 8) => (t < 0 ? 0 : Math.exp(-sinceBeat(t) * decay));
const sinceT = (t, t0) => (t < t0 ? Infinity : t - t0);
const flashAt = (t, t0, decay = 6) => (t < t0 ? 0 : Math.exp(-(t - t0) * decay));

// colour
const PAL = {
  pink: '#FF66AA', pinkLight: '#FF99C7', pinkDark: '#CC5288', pinkDarker: '#BB1177',
  purple: '#8866EE', purpleLight: '#AA88FF', purpleDark: '#6644CC', purpleDarker: '#441188',
  blue: '#66CCFF', blueDark: '#44AADD', yellow: '#FFCC22', green: '#B3D944', red: '#ED1121',
  plum: '#1A0F1F', navy: '#0D0F1E',
};
const COMBO = ['#FFC000', '#00CA00', '#127CFF', '#F21839'];
const JUDGE = { 300: '#66CCFF', 100: '#B3D944', 50: '#FFCC22', 0: '#ED1121' };

function hex2rgb(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
const toRgb = c => (typeof c === 'string' ? hex2rgb(c) : c);
function rgba(c, a = 1) { const [r, g, b] = toRgb(c); return `rgba(${r | 0},${g | 0},${b | 0},${a})`; }
function mix(c1, c2, k) { const a = toRgb(c1), b = toRgb(c2); return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; }
const lighten = (c, k) => mix(c, [255, 255, 255], k);
const darken = (c, k) => mix(c, [0, 0, 0], k);

// canvas helpers
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

function setFont(ctx, size, weight = 700, italic = false, family = "'Exo 2'") {
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`;
}

function text(ctx, s, x, y, o = {}) {
  const { size = 40, weight = 700, italic = false, align = 'left', baseline = 'alphabetic', color = '#fff',
    alpha = 1, spacing = 0, family, stroke = null, strokeWidth = 2, shadow = null } = o;
  if (alpha <= 0) return;
  ctx.save();
  setFont(ctx, size, weight, italic, family);
  ctx.textAlign = align; ctx.textBaseline = baseline;
  ctx.letterSpacing = spacing + 'px';
  ctx.globalAlpha *= alpha;
  if (shadow) { ctx.shadowColor = shadow.color; ctx.shadowBlur = shadow.blur; ctx.shadowOffsetX = shadow.x || 0; ctx.shadowOffsetY = shadow.y || 0; }
  if (color) { ctx.fillStyle = color; ctx.fillText(s, x, y); }
  if (stroke) { ctx.shadowColor = 'transparent'; ctx.strokeStyle = stroke; ctx.lineWidth = strokeWidth; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); }
  ctx.restore();
}

function measure(ctx, s, size, weight = 700, italic = false, spacing = 0, family) {
  ctx.save(); setFont(ctx, size, weight, italic, family); ctx.letterSpacing = spacing + 'px';
  const w = ctx.measureText(s).width; ctx.restore(); return w;
}

// Per-letter animated text. Letters pop in with a stagger and drop out with a stagger.
function kinetic(ctx, s, x, y, t, o = {}) {
  const { size = 80, weight = 800, italic = true, align = 'left', color = '#fff', spacing = 0, family,
    t0 = 0, stagger = 0.03, dur = 0.35, tOut = Infinity, outStagger = 0.015, outDur = 0.25,
    rise = 0.5, mode = 'rise', stroke = null, strokeWidth = 2, alpha = 1 } = o;
  if (t < t0 || alpha <= 0) return;
  ctx.save();
  setFont(ctx, size, weight, italic, family);
  ctx.letterSpacing = spacing + 'px';
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const total = ctx.measureText(s).width;
  let x0 = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
  const chars = [...s];
  let acc = '';
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const cx = x0 + ctx.measureText(acc).width;
    acc += ch;
    if (ch === ' ') continue;
    const ki = inv(t0 + i * stagger, t0 + i * stagger + dur, t);
    const ko = tOut === Infinity ? 0 : inv(tOut + i * outStagger, tOut + i * outStagger + outDur, t);
    if (ki <= 0 || ko >= 1) continue;
    const e = ease.outBack(ki), eo = ease.inCubic(ko);
    const a = clamp(ki * 2) * (1 - eo) * alpha;
    ctx.save();
    ctx.globalAlpha *= a;
    const w = ctx.measureText(ch).width;
    if (mode === 'rise') {
      ctx.translate(cx + w / 2, y + (1 - e) * size * rise + eo * size * 0.4);
    } else { // 'scale'
      ctx.translate(cx + w / 2, y - size * 0.35);
      const sc = lerp(1.8, 1, ease.outCubic(ki)) * (1 - 0.3 * eo);
      ctx.scale(sc, sc);
      ctx.translate(0, size * 0.35);
    }
    if (color) { ctx.fillStyle = color; ctx.fillText(ch, -w / 2, 0); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = strokeWidth; ctx.strokeText(ch, -w / 2, 0); }
    ctx.restore();
  }
  ctx.restore();
}

// soft glow sprite (cached per colour)
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
  ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.restore();
}
function disc(ctx, x, y, r, color, alpha = 1) {
  if (alpha <= 0 || r <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = typeof color === 'string' ? color : rgba(color);
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.restore();
}
function triPath(ctx, x, y, s, rot = 0) {
  const R = s / Math.sqrt(3);
  ctx.moveTo(x + R * Math.cos(rot - PI / 2), y + R * Math.sin(rot - PI / 2));
  ctx.lineTo(x + R * Math.cos(rot - PI / 2 + TAU / 3), y + R * Math.sin(rot - PI / 2 + TAU / 3));
  ctx.lineTo(x + R * Math.cos(rot - PI / 2 + 2 * TAU / 3), y + R * Math.sin(rot - PI / 2 + 2 * TAU / 3));
  ctx.closePath();
}

// lazer-style rising triangles. `travel` is pixels scrolled so far (lets scenes speed it up on drops).
class TriField {
  constructor(seed, n, colors, o = {}) {
    const r = rng(seed);
    this.o = Object.assign({ minS: 40, maxS: 260, alpha: [0.25, 0.9], w: W, h: H }, o);
    this.tris = [];
    for (let i = 0; i < n; i++) {
      const k = Math.pow(r(), 1.6);
      const s = lerp(this.o.minS, this.o.maxS, k);
      this.tris.push({
        x: r() * this.o.w, y: r() * (this.o.h + 2 * this.o.maxS), s,
        c: colors[Math.floor(r() * colors.length)], a: lerp(this.o.alpha[0], this.o.alpha[1], r()),
        v: lerp(1.4, 0.55, k), outline: r() < (this.o.outline || 0),
      });
    }
    this.tris.sort((a, b) => b.s - a.s);
  }
  draw(ctx, travel, alpha = 1, ox = 0, oy = 0) {
    if (alpha <= 0) return;
    const span = this.o.h + 2 * this.o.maxS;
    ctx.save();
    for (const tr of this.tris) {
      let y = tr.y - travel * tr.v;
      y = ((y % span) + span) % span - this.o.maxS;
      ctx.globalAlpha = tr.a * alpha;
      ctx.beginPath(); triPath(ctx, tr.x + ox, y + oy, tr.s);
      if (tr.outline) { ctx.strokeStyle = tr.c; ctx.lineWidth = 2; ctx.stroke(); }
      else { ctx.fillStyle = tr.c; ctx.fill(); }
    }
    ctx.restore();
  }
}

// cumulative "travel" with impulses (fast on drops, then settle)
function travelFn(base, impulses, beatKicks = []) {
  return t => {
    let d = base * t;
    for (const [ti, A, dec] of impulses) if (t > ti) d += (A / dec) * (1 - Math.exp(-dec * (t - ti)));
    for (const [a, b, A, dec] of beatKicks) {
      if (t <= a) continue;
      const tt = Math.min(t, b);
      const n = Math.floor((tt - a) / BEAT + 1e-6);
      d += n * (A / dec) * (1 - Math.exp(-dec * BEAT));
      const rem = tt - a - n * BEAT;
      d += (A / dec) * (1 - Math.exp(-dec * rem));
    }
    return d;
  };
}

// audio cue list, consumed by scripts/make_audio.py
const CUES = [];
function cue(t, type, o = {}) { CUES.push(Object.assign({ t: +t.toFixed(5), type }, o)); }
const panOf = x => +clamp((x / W - 0.5) * 1.2, -0.8, 0.8).toFixed(3);

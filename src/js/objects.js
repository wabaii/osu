'use strict';
// osu!lazer's default "argon" skin, redrawn on canvas from its source
// (osu.Game.Rulesets.Osu/Skinning/Argon/*): hit circles, sliders, spinner, follow points,
// judgements and cursor, plus a small beatmap model that emits combos, key presses and audio cues.

const IMG = {};

// ArgonMainCirclePiece geometry, in units of OsuHitObject.OBJECT_RADIUS (64)
const OBJ = 64;
const BORDER = OBJ * 2 * (2 / 58);
const GRAD = BORDER * 2.5;
const OUTER_GRAD = OBJ * 2 - BORDER * 4;
const INNER_GRAD = OUTER_GRAD - GRAD * 2;
const INNER_FILL = INNER_GRAD - GRAD * 2;

// ---------- hit circle ----------
const RS = 128, KS = RS / OBJ;
const _argon = new Map();
function argonSprite(color, outerFill = true) {
  const key = color + outerFill;
  if (_argon.has(key)) return _argon.get(key);
  const S = RS * 2 + 8, c = makeCanvas(S, S), g = c.getContext('2d'), m = S / 2;
  const discG = (r, top, bottom) => {
    const gr = g.createLinearGradient(0, m - r, 0, m + r);
    gr.addColorStop(0, rgba(top)); gr.addColorStop(1, rgba(bottom));
    g.fillStyle = gr; g.beginPath(); g.arc(m, m, r, 0, TAU); g.fill();
  };
  if (outerFill) discG((OBJ - 0.5) * KS, fwDarken(color, 4), fwDarken(color, 4));
  discG((OUTER_GRAD / 2) * KS, toRgb(color), fwDarken(color, 0.1));
  discG((INNER_GRAD / 2) * KS, fwDarken(color, 0.5), fwDarken(color, 0.6));
  discG((INNER_FILL / 2) * KS, fwDarken(color, 4), fwDarken(color, 4));
  g.strokeStyle = '#fff'; g.lineWidth = BORDER * KS; g.beginPath(); g.arc(m, m, (OBJ - BORDER / 2) * KS, 0, TAU); g.stroke();
  _argon.set(key, c); return c;
}

function circleNumber(ctx, x, y, r, num, alpha) {
  if (num == null || alpha <= 0) return;
  const k = r / OBJ;
  text(ctx, String(num), x, y - 2 * k, { size: 46 * k, weight: 700, align: 'center', baseline: 'middle', alpha, shadow: { color: 'rgba(0,0,0,0.35)', blur: 4 * k, y: 1 } });
}

function drawCircle(ctx, x, y, r, color, num, alpha = 1, outerFill = true) {
  if (alpha <= 0) return;
  const sp = argonSprite(color, outerFill), S = sp.width * (r / RS);
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.drawImage(sp, x - S / 2, y - S / 2, S, S);
  ctx.restore();
  circleNumber(ctx, x, y, r, num, alpha);
}

// ArgonMainCirclePiece hit animation (the "bomb" explosion)
function drawHitBurst(ctx, x, y, r, color, dt, num, outerFill = true) {
  if (dt < 0 || dt > 0.8) return;
  const k = r / OBJ, whole = 1 - ease.outQuad(inv(0, 0.8, dt));
  ctx.save(); ctx.globalAlpha *= whole;
  const fillA = 1 - ease.outQuint(inv(0, 0.15, dt));
  if (outerFill) disc(ctx, x, y, (OBJ - 0.5) * k, fwDarken(color, 4), fillA);
  // outer gradient shrinks (elastic) slightly after the border, flashing white then fading
  const og = ease.outElasticHalf(inv(0.0125, 0.4125, dt));
  const ogR = lerp(OUTER_GRAD / 2, (OUTER_GRAD / 2) * 0.8, og) * k;
  const ogA = 1 - ease.outQuint(inv(0.0925, 0.2425, dt));
  disc(ctx, x, y, ogR, mix(color, '#ffffff', inv(0.0125, 0.0925, dt)), ogA);
  disc(ctx, x, y, (INNER_GRAD / 2) * k, fwDarken(color, 0.5), fillA);
  disc(ctx, x, y, (INNER_FILL / 2) * k, fwDarken(color, 4), fillA);
  circleNumber(ctx, x, y, r, num, 1 - inv(0, 0.075, dt));
  // additive flash (hit lighting)
  const fl = ease.outQuint(inv(0, 0.15, dt));
  glow(ctx, x, y, r * 1.7, color, fl * 0.9);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; disc(ctx, x, y, (OBJ / 2) * k, color, fl * 0.7); ctx.restore();
  // border shrinks to 0.8 and takes the accent colour, fading top-to-bottom
  const be = ease.outElasticHalf(inv(0, 0.4, dt));
  const bR = lerp(OBJ - BORDER / 2, OBJ * 0.8 + BORDER / 2 - BORDER / 2, be) * k;
  const p = inv(0, 0.8, dt), bc = mix('#ffffff', color, ease.outQuad(p));
  const gr = ctx.createLinearGradient(0, y - bR, 0, y + bR);
  gr.addColorStop(0, rgba(bc, lerp(1, 0.5, p))); gr.addColorStop(1, rgba(bc, lerp(1, 0, p)));
  ctx.strokeStyle = gr; ctx.lineWidth = BORDER * k; ctx.beginPath(); ctx.arc(x, y, bR, 0, TAU); ctx.stroke();
  ctx.restore();
}

function drawApproach(ctx, x, y, r, color, k, alpha) {
  if (alpha <= 0 || !IMG.approach) return;
  const s = lerp(4, 1, k), D = 2 * r * s;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.drawImage(tinted(IMG.approach, rgba(color)), x - D / 2, y - D / 2, D, D);
  ctx.restore();
}

// ArgonJudgementPiece: additive "GREAT" text plus a burst of small rings
function drawJudgement(ctx, x, y, dt, sc, seed) {
  if (dt < 0 || dt > 1.0) return;
  const a = (1 - inv(0, 0.8, dt)) * ease.outQuint(inv(0, 0.3, dt));
  const s = lerp(1, 1.2, ease.outQuint(inv(0, 1.8, dt)));
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  if (a > 0) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    text(ctx, 'GREAT', 0, 0, { size: 20 * sc, weight: 700, align: 'center', baseline: 'middle', spacing: 5 * sc, color: HIT.great, alpha: a });
    ctx.restore();
  }
  const r = rng(seed), ringsA = 1 - ease.outQuint(inv(0, 1.0, dt)), mv = ease.outQuint(inv(0, 0.6, dt));
  for (let i = 0; i < 8; i++) {
    const dir = r() * TAU, d = lerp(26, 52, r()) * sc, size = (i < 4 ? 9 : 14) * sc;
    const dd = lerp(0.3, 1, mv) * d;
    ring(ctx, x + Math.cos(dir) * dd, y + Math.sin(dir) * dd, size / 2 - 2 * sc, 4 * sc, HIT.great, ringsA * 0.9);
  }
  ctx.restore();
}

// ---------- slider paths ----------
class Path {
  constructor(pts, type = 'catmull', samples = 300) {
    const raw = [];
    if (type === 'linear') {
      for (let i = 0; i < pts.length - 1; i++) for (let j = 0; j < samples / (pts.length - 1); j++) {
        const k = j / (samples / (pts.length - 1));
        raw.push({ x: lerp(pts[i].x, pts[i + 1].x, k), y: lerp(pts[i].y, pts[i + 1].y, k) });
      }
      raw.push(pts[pts.length - 1]);
    } else if (type === 'bezier') {
      for (let i = 0; i <= samples; i++) raw.push(Path.bez(pts, i / samples));
    } else if (type === 'arc') {
      const [a, b, c] = pts, cc = Path.circ(a, b, c);
      const a0 = Math.atan2(a.y - cc.y, a.x - cc.x), a1 = Math.atan2(b.y - cc.y, b.x - cc.x), a2 = Math.atan2(c.y - cc.y, c.x - cc.x);
      const norm = v => ((v % TAU) + TAU) % TAU;
      const sweep = norm(a1 - a0) < norm(a2 - a0) ? norm(a2 - a0) : -norm(a0 - a2);
      for (let i = 0; i <= samples; i++) { const ang = a0 + sweep * (i / samples); raw.push({ x: cc.x + cc.r * Math.cos(ang), y: cc.y + cc.r * Math.sin(ang) }); }
    } else {
      const P = [pts[0], ...pts, pts[pts.length - 1]], per = Math.ceil(samples / (pts.length - 1));
      for (let i = 1; i < P.length - 2; i++) for (let j = 0; j < per; j++) {
        const t = j / per, p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2];
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
        raw.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
      }
      raw.push(pts[pts.length - 1]);
    }
    this.pts = raw; this.cum = [0];
    for (let i = 1; i < raw.length; i++) this.cum.push(this.cum[i - 1] + dist(raw[i - 1].x, raw[i - 1].y, raw[i].x, raw[i].y));
    this.len = this.cum[this.cum.length - 1];
  }
  static bez(p, t) {
    let q = p.map(o => ({ x: o.x, y: o.y }));
    for (let k = q.length - 1; k > 0; k--) for (let i = 0; i < k; i++) q[i] = { x: lerp(q[i].x, q[i + 1].x, t), y: lerp(q[i].y, q[i + 1].y, t) };
    return q[0];
  }
  static circ(a, b, c) {
    const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    const ux = ((a.x ** 2 + a.y ** 2) * (b.y - c.y) + (b.x ** 2 + b.y ** 2) * (c.y - a.y) + (c.x ** 2 + c.y ** 2) * (a.y - b.y)) / d;
    const uy = ((a.x ** 2 + a.y ** 2) * (c.x - b.x) + (b.x ** 2 + b.y ** 2) * (a.x - c.x) + (c.x ** 2 + c.y ** 2) * (b.x - a.x)) / d;
    return { x: ux, y: uy, r: dist(ux, uy, a.x, a.y) };
  }
  idx(d) {
    d = clamp(d, 0, this.len);
    let lo = 0, hi = this.cum.length - 1;
    while (lo < hi - 1) { const m = (lo + hi) >> 1; if (this.cum[m] <= d) lo = m; else hi = m; }
    return lo;
  }
  at(d) {
    d = clamp(d, 0, this.len);
    const i = this.idx(d), j = Math.min(i + 1, this.pts.length - 1);
    const seg = this.cum[j] - this.cum[i] || 1, k = (d - this.cum[i]) / seg, p = this.pts[i], q = this.pts[j];
    return { x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k), a: Math.atan2(q.y - p.y, q.x - p.x) };
  }
  endAngle() { const n = this.pts.length, p = this.pts[n - 4] || this.pts[0], q = this.pts[n - 1]; return Math.atan2(q.y - p.y, q.x - p.x); }
  startAngle() { const p = this.pts[0], q = this.pts[3] || this.pts[1]; return Math.atan2(q.y - p.y, q.x - p.x); }
  trace(ctx, d0, d1) {
    const i0 = this.idx(d0), i1 = this.idx(d1), a = this.at(d0);
    ctx.moveTo(a.x, a.y);
    for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(this.pts[i].x, this.pts[i].y);
    const b = this.at(d1); ctx.lineTo(b.x, b.y);
  }
}

// ArgonSliderBody: dark body (accent darkened 4x) with a border in the combo colour
let _scratch = null;
function drawSliderBody(ctx, path, d0, d1, r, color, alpha) {
  if (alpha <= 0 || d1 <= d0 + 0.01) return;
  if (!_scratch) _scratch = makeCanvas(W, H);
  const g = _scratch.getContext('2d'), k = r / OBJ, R = (OUTER_GRAD / 2) * k;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = Math.max(0, path.idx(d0) - 1); i <= Math.min(path.pts.length - 1, path.idx(d1) + 1); i++) {
    const p = path.pts[i]; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  const pad = R + 6;
  x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad)); x1 = Math.min(W, Math.ceil(x1 + pad)); y1 = Math.min(H, Math.ceil(y1 + pad));
  if (x1 <= x0 || y1 <= y0) return;
  g.clearRect(x0, y0, x1 - x0, y1 - y0);
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  const stroke = (w, c) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); path.trace(g, d0, d1); g.stroke(); };
  stroke(2 * R, rgba(color));
  stroke(2 * (R - GRAD * k), rgba(fwDarken(color, 4)));
  g.restore();
  ctx.save(); ctx.globalAlpha *= alpha * 0.98;
  ctx.drawImage(_scratch, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}

function chevron(ctx, x, y, ang, s, color, double = false, lw = 0.32) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  ctx.strokeStyle = color; ctx.lineWidth = s * lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const one = ox => { ctx.beginPath(); ctx.moveTo(ox - s * 0.25, -s * 0.45); ctx.lineTo(ox + s * 0.2, 0); ctx.lineTo(ox - s * 0.25, s * 0.45); ctx.stroke(); };
  if (double) { one(-s * 0.22); one(s * 0.22); } else one(0);
  ctx.restore();
}

// ArgonReverseArrow: white pill with a dark double chevron, plus the pulsing edge piece
function drawReverseArrow(ctx, x, y, ang, r, color, alpha, t, t0) {
  if (alpha <= 0) return;
  const k = r / OBJ, loop = ((t - t0) % 0.3 + 0.3) % 0.3;
  const sc = loop < 0.035 ? lerp(1, 1.3, ease.outQuad(loop / 0.035)) : lerp(1.3, 1, ease.outQuad(inv(0.035, 0.285, loop)));
  const side = loop < 0.035 ? lerp(0, -12, ease.outQuad(loop / 0.035)) : lerp(-12, 0, ease.outQuad(inv(0.035, 0.285, loop)));
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha *= alpha;
  if (IMG.edge) { const D = OUTER_GRAD * k; ctx.drawImage(IMG.edge, side * k - D / 2, -D / 2, D, D); }
  ctx.scale(sc, sc);
  ctx.fillStyle = '#fff'; roundRect(ctx, -20 * k, -10 * k, 40 * k, 20 * k, 10 * k); ctx.fill();
  chevron(ctx, 0, 0, 0, 16 * k, rgba(fwDarken(color, 4)), true, 0.24);
  ctx.restore();
}

// ArgonSliderBall: accent-gradient ball with a thick white border and a direction chevron
function drawSliderBall(ctx, x, y, r, color, ang, alpha) {
  if (alpha <= 0) return;
  const k = r / OBJ, R = (OUTER_GRAD / 2) * k;
  ctx.save(); ctx.globalAlpha *= alpha;
  const gr = ctx.createLinearGradient(0, y - R, 0, y + R);
  gr.addColorStop(0, rgba(color)); gr.addColorStop(1, rgba(fwDarken(color, 0.5)));
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#fff'; ctx.lineWidth = GRAD * k; ctx.beginPath(); ctx.arc(x, y, R - (GRAD * k) / 2, 0, TAU); ctx.stroke();
  chevron(ctx, x, y, ang, 30 * k, '#fff', false, 0.26);
  ctx.restore();
}

// ArgonFollowCircle: additive ring + 30% fill, scales out to the follow area (2.4x)
function drawFollowCircle(ctx, x, y, r, scale, alpha, color) {
  if (alpha <= 0) return;
  const R = r * scale;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createLinearGradient(0, y - R, 0, y + R);
  gr.addColorStop(0, rgba(color)); gr.addColorStop(1, rgba(fwDarken(color, 0.5)));
  ctx.fillStyle = gr; ctx.globalAlpha *= 0.3; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  ctx.globalAlpha /= 0.3; ctx.strokeStyle = gr; ctx.lineWidth = 4 * (r / OBJ) * 1.6; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke();
  ctx.restore();
}

function drawTick(ctx, x, y, r, color, alpha) { ring(ctx, x, y, r * 0.13, 3 * (r / OBJ), rgba(color), alpha); }

// ArgonFollowPoint: two small chevrons, pink gradient, additive
function drawFollowPoint(ctx, x, y, ang, s, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.globalCompositeOperation = 'lighter';
  chevron(ctx, x - Math.cos(ang) * s * 0.25, y - Math.sin(ang) * s * 0.25, ang, s, rgba(gray(51)), false, 0.34);
  chevron(ctx, x + Math.cos(ang) * s * 0.25, y + Math.sin(ang) * s * 0.25, ang, s, PAL.argonPink, false, 0.34);
  ctx.restore();
}

// ---------- cursor ----------
class CursorPath {
  constructor() { this.anchors = []; this.clicks = []; }
  point(t, x, y) { this.anchors.push({ t0: t, t1: t, f: () => ({ x, y }) }); return this; }
  seg(t0, t1, f) { this.anchors.push({ t0, t1, f }); return this; }
  click(t) { this.clicks.push(t); return this; }
  done() { this.anchors.sort((a, b) => a.t0 - b.t0); this.clicks.sort((a, b) => a - b); return this; }
  at(t) {
    const A = this.anchors; if (!A.length) return { x: W / 2, y: H / 2 };
    if (t <= A[0].t0) return A[0].f(A[0].t0);
    let lo = 0, hi = A.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (A[m].t0 <= t) lo = m; else hi = m - 1; }
    const a = A[lo];
    if (t <= a.t1) return a.f(t);
    if (lo === A.length - 1) return a.f(a.t1);
    const b = A[lo + 1], p = a.f(a.t1), q = b.f(b.t0), gap = b.t0 - a.t1;
    const k0 = inv(a.t1, a.t1 + gap * (gap < 0.12 ? 1 : 0.86), t);
    const e = gap < 0.12 ? k0 : gap < 0.25 ? ease.inOutSine(k0) : ease.inOutCubic(k0);
    const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1, bend = Math.sin(e * PI) * L * 0.06 * (lo % 2 ? 1 : -1);
    return { x: p.x + dx * e - (dy / L) * bend, y: p.y + dy * e + (dx / L) * bend };
  }
  pressAge(t) { let last = -Infinity; for (const c of this.clicks) { if (c <= t) last = c; else break; } return t - last; }
}

// ArgonCursor + ArgonCursorTrail
function drawGameCursor(ctx, cp, t, o = {}) {
  const { scale = 1, alpha = 1 } = o;
  if (alpha <= 0) return;
  const p = cp.at(t);
  ctx.save(); ctx.globalAlpha *= alpha;
  // trail: dense additive dots along the recent path, fading with exponent 4
  ctx.globalCompositeOperation = 'lighter';
  const N = 90, span = 0.16;
  let prev = null;
  for (let i = N; i >= 1; i--) {
    const age = (i / N) * span, q = cp.at(t - age);
    if (prev && dist(prev.x, prev.y, q.x, q.y) < 2.5 && i % 3) continue;
    prev = q;
    const a = Math.pow(1 - age / span, 4) * 0.8, s = 9 * scale;
    ctx.globalAlpha = alpha * a;
    if (IMG.trail) ctx.drawImage(IMG.trail, q.x - s / 2, q.y - s / 2, s, s); else disc(ctx, q.x, q.y, s / 2, '#fff');
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = alpha;
  const pa = cp.pressAge(t), press = pa < 0.2 ? lerp(1.2, 1, ease.outElastic(inv(0, 0.2, pa))) : 1;
  const R = 28 * scale * press;
  disc(ctx, p.x, p.y, R, fwDarken(PAL.argonPink, 0.6), 0.4);
  const gr = ctx.createLinearGradient(0, p.y - R, 0, p.y + R); gr.addColorStop(0, PAL.argonPink); gr.addColorStop(1, PAL.argonPinkDark);
  ctx.strokeStyle = gr; ctx.lineWidth = 6 * scale; ctx.beginPath(); ctx.arc(p.x, p.y, R - 3 * scale, 0, TAU); ctx.stroke();
  ring(ctx, p.x, p.y, R - 7 * scale, 2 * scale, 'rgba(255,255,255,0.8)');
  glow(ctx, p.x, p.y, 26 * scale, PAL.glowCyan, 0.55);
  disc(ctx, p.x, p.y, R * 0.2, '#fff');
  ctx.restore();
}

// lazer's menu cursor (official texture)
function drawMenuCursor(ctx, cp, t, alpha = 1) {
  if (alpha <= 0 || !IMG.menuCursor) return;
  const p = cp.at(t), pa = cp.pressAge(t), s = pa < 0.25 ? lerp(0.85, 1, ease.outElastic(inv(0, 0.25, pa))) : 1;
  const w = 40 * s, h = w * (442 / 312);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 8;
  ctx.drawImage(IMG.menuCursor, p.x - w * 0.05, p.y - h * 0.03, w, h); ctx.restore();
}

// ---------- beatmap ----------
class Beatmap {
  constructor(o = {}) {
    this.r = o.r || 76; this.preempt = o.preempt || 0.6; this.fadeIn = o.fadeIn || 0.4;
    this.sc = o.sc || 2; // playfield scale (osu!px -> screen px)
    this.objs = []; this.ci = (o.colorStart || 0) - 1; this.n = 0; this.colors = o.colors || COMBO;
    this.seed = o.seed || 1; this.judgeGap = o.judgeGap || 0; this.vol = o.vol || 1;
  }
  _base(t, nc) {
    if (nc || !this.objs.length) { this.ci = (this.ci + 1) % this.colors.length; this.n = 0; }
    this.n++;
    return { t, color: this.colors[this.ci], n: this.n, nc: nc || this.n === 1 };
  }
  circle(t, x, y, o = {}) {
    this.objs.push(Object.assign(this._base(t, o.nc), { type: 'circle', x, y, end: t, ex: x, ey: y, sound: o.sound || 'normal' }));
    return this;
  }
  slider(t, pts, o = {}) {
    const path = new Path(pts, o.curve || 'catmull'), span = o.span, repeats = o.repeats || 0, dur = span * (repeats + 1);
    const s0 = path.at(0), s1 = repeats % 2 ? path.at(0) : path.at(path.len);
    const ticks = [];
    if (o.tickEvery) for (let tt = o.tickEvery; tt < span - 0.01; tt += o.tickEvery) ticks.push((tt / span) * path.len);
    this.objs.push(Object.assign(this._base(t, o.nc), { type: 'slider', x: s0.x, y: s0.y, path, span, repeats, dur, end: t + dur, ex: s1.x, ey: s1.y, ticks, sound: o.sound || 'normal' }));
    return this;
  }
  spinner(t, end, x, y, R, o = {}) {
    this.objs.push(Object.assign(this._base(t, true), { type: 'spinner', x, y, R, end, ex: x, ey: y, wmax: o.wmax || (477 / 60) * TAU, ramp: o.ramp || 0.5, need: o.need || 8 }));
    this.n = 0;
    return this;
  }
  ballAt(o, t) {
    const u = clamp((t - o.t) / o.span, 0, o.repeats + 1), pass = Math.min(Math.floor(u), o.repeats), f = u - pass;
    const p = o.path.at((pass % 2 === 0 ? f : 1 - f) * o.path.len);
    return { x: p.x, y: p.y, a: p.a + (pass % 2 ? PI : 0), pass, f };
  }
  spinAngle(o, t) {
    const dt = clamp(t - o.t, 0, o.end - o.t);
    return dt < o.ramp ? (o.wmax * dt * dt) / (2 * o.ramp) : (o.wmax * o.ramp) / 2 + o.wmax * (dt - o.ramp);
  }
  spinTime(o, n) {
    const ang = n * TAU, angRamp = (o.wmax * o.ramp) / 2;
    return ang <= angRamp ? o.t + Math.sqrt((2 * o.ramp * ang) / o.wmax) : o.t + o.ramp + (ang - angRamp) / o.wmax;
  }
  finalize() {
    const r = rng(this.seed);
    this.events = []; this.hits = [];
    for (const o of this.objs) {
      o.err = (r() + r() + r() - 1.5) * 0.012;
      const pan = panOf(o.x);
      if (o.type === 'circle') {
        this.events.push({ t: o.t, o, kind: 'hit' });
        this.hits.push({ t: o.t, dur: 0.07, o });
        cue(o.t, 'hit', { s: o.sound, pan, vol: this.vol });
      } else if (o.type === 'slider') {
        this.events.push({ t: o.t, o, kind: 'head' });
        this.hits.push({ t: o.t, dur: o.dur, o });
        cue(o.t, 'hit', { s: o.sound, pan, vol: this.vol });
        cue(o.t, 'slide', { dur: +o.dur.toFixed(4), pan, vol: this.vol });
        for (let p = 0; p <= o.repeats; p++) {
          for (const d of o.ticks) {
            const tickT = o.t + p * o.span + ((p % 2 ? o.path.len - d : d) / o.path.len) * o.span;
            this.events.push({ t: tickT, o, kind: 'tick' });
            cue(tickT, 'tick', { pan: panOf(o.path.at(d).x), vol: this.vol });
          }
          const tEnd = o.t + (p + 1) * o.span, q = o.path.at(p % 2 ? 0 : o.path.len);
          this.events.push({ t: tEnd, o, kind: p === o.repeats ? 'tail' : 'repeat' });
          cue(tEnd, 'hit', { s: p === o.repeats ? 'normal' : 'whistle', pan: panOf(q.x), vol: this.vol * 0.85 });
        }
      } else if (o.type === 'spinner') {
        this.hits.push({ t: o.t, dur: o.end - o.t, o });
        cue(o.t, 'spin', { dur: +(o.end - o.t).toFixed(4), vol: this.vol });
        cue(o.end, 'hit', { s: 'finish', pan: 0, vol: this.vol });
        const total = Math.floor(this.spinAngle(o, o.end) / TAU);
        for (let s = o.need + 1; s <= total; s++) cue(this.spinTime(o, s), 'spinbonus', { n: s - o.need, vol: this.vol * 0.8 });
        this.events.push({ t: o.end, o, kind: 'spinend' });
      }
    }
    this.events.sort((a, b) => a.t - b.t);
    let combo = 0; this.events.forEach(e => (e.combo = ++combo));
    this.hits.sort((a, b) => a.t - b.t);
    this.hits.forEach((h, i) => { h.key = i % 2; const nx = this.hits[i + 1]; if (h.o.type === 'circle' && nx) h.dur = Math.min(0.07, (nx.t - h.t) * 0.6); });
    this.objs.forEach((o, i) => { const nx = this.objs[i + 1]; o.showJudge = !nx || nx.t - o.end >= this.judgeGap; });
    // follow points (within a combo), spaced 32 osu!px apart
    this.fps = [];
    for (let i = 0; i < this.objs.length - 1; i++) {
      const a = this.objs[i], b = this.objs[i + 1];
      if (b.nc || a.type === 'spinner' || b.type === 'spinner') continue;
      const L = dist(a.ex, a.ey, b.x, b.y);
      if (L < this.r * 2.4) continue;
      const ang = Math.atan2(b.y - a.ey, b.x - a.ex), step = 32 * this.sc;
      for (let d = step * 1.5; d < L - this.r * 1.1; d += step) {
        const f = d / L, tt = lerp(a.end, b.t, f);
        this.fps.push({ x: lerp(a.ex, b.x, f), y: lerp(a.ey, b.y, f), ang, tIn: tt - this.preempt, tOut: tt });
      }
    }
    return this;
  }
  comboAt(t) { let c = 0; for (const e of this.events) { if (e.t <= t) c = e.combo; else break; } return c; }
  lastEventBefore(t) { let l = null; for (const e of this.events) { if (e.t <= t) l = e; else break; } return l; }
  cursor(cp) {
    for (const o of this.objs) {
      if (o.type === 'circle') cp.point(o.t, o.x, o.y).click(o.t);
      else if (o.type === 'slider') cp.seg(o.t, o.end, t => this.ballAt(o, t)).click(o.t);
      else if (o.type === 'spinner') cp.seg(o.t, o.end, t => { const a = this.spinAngle(o, t), rr = o.R * (0.42 + 0.05 * Math.sin(t * 3.1)); return { x: o.x + Math.cos(a - PI / 2) * rr, y: o.y + Math.sin(a - PI / 2) * rr }; }).click(o.t);
    }
    return cp;
  }
  draw(ctx, t, o = {}) {
    const alphaMul = o.alpha == null ? 1 : o.alpha;
    if (alphaMul <= 0) return;
    ctx.save(); ctx.globalAlpha *= alphaMul;
    for (const f of this.fps) {
      if (t < f.tIn || t > f.tOut + 0.4) continue;
      const a = t < f.tOut ? ease.outQuad(inv(f.tIn, f.tIn + 0.3, t)) : 1 - inv(f.tOut, f.tOut + 0.4, t);
      const sh = (1 - ease.outQuint(inv(f.tIn, f.tIn + 0.3, t))) * 10 * this.sc;
      drawFollowPoint(ctx, f.x - Math.cos(f.ang) * sh, f.y - Math.sin(f.ang) * sh, f.ang, 8 * this.sc, a);
    }
    const vis = this.objs.filter(ob => t >= ob.t - this.preempt && t <= ob.end + 1.0);
    for (let i = vis.length - 1; i >= 0; i--) this._drawObj(ctx, vis[i], t);
    for (const ob of vis) {
      if (ob.type === 'spinner' || t >= ob.t) continue;
      drawApproach(ctx, ob.x, ob.y, this.r, ob.color, inv(ob.t - this.preempt, ob.t, t), 0.9 * inv(ob.t - this.preempt, ob.t - this.preempt + Math.min(this.preempt, this.fadeIn * 2), t));
    }
    for (const ob of vis) {
      if (!ob.showJudge || ob.type === 'spinner') continue;
      const jt = ob.type === 'slider' ? ob.end : ob.t, jx = ob.type === 'slider' ? ob.ex : ob.x, jy = ob.type === 'slider' ? ob.ey : ob.y;
      drawJudgement(ctx, jx, jy, t - jt, this.sc, Math.floor(jt * 1000));
    }
    ctx.restore();
  }
  _drawObj(ctx, ob, t) {
    const r = this.r, a = inv(ob.t - this.preempt, ob.t - this.preempt + this.fadeIn, t);
    if (ob.type === 'circle') {
      if (t < ob.t) drawCircle(ctx, ob.x, ob.y, r, ob.color, ob.n, a);
      else drawHitBurst(ctx, ob.x, ob.y, r, ob.color, t - ob.t, ob.n);
    } else if (ob.type === 'slider') {
      const P = ob.path, out = t > ob.end ? 1 - ease.outQuad(inv(ob.end, ob.end + 0.25, t)) : 1;
      const snake = ease.outQuad(inv(ob.t - this.preempt, ob.t - this.preempt * 0.4, t));
      const b = t >= ob.t ? this.ballAt(ob, t) : null;
      // lazer snakes the body out behind the ball on the last pass
      let d0 = 0;
      if (b && b.pass === ob.repeats && t < ob.end) d0 = (b.pass % 2 === 0 ? b.f : 1 - b.f) * P.len * (b.pass % 2 === 0 ? 1 : 0);
      if (out > 0) {
        drawSliderBody(ctx, P, d0, P.len * snake, r, ob.color, a * out);
        if (snake > 0.98 && t < ob.end) {
          const cur = b ? b.pass : 0;
          for (const d of ob.ticks) {
            let show = true;
            if (b) { const fwd = b.pass % 2 === 0, bd = (fwd ? b.f : 1 - b.f) * P.len; show = fwd ? d > bd : d < bd; }
            if (show) { const q = P.at(d); drawTick(ctx, q.x, q.y, r, ob.color, a); }
          }
          if (cur < ob.repeats) {
            const atEnd = cur % 2 === 0, q = P.at(atEnd ? P.len : 0);
            drawReverseArrow(ctx, q.x, q.y, atEnd ? P.endAngle() + PI : P.startAngle(), r, ob.color, a, t, ob.t - this.preempt);
          }
        }
        if (t < ob.t) drawCircle(ctx, ob.x, ob.y, r, ob.color, ob.n, a, false);
        if (b && t <= ob.end) {
          const fs = lerp(1, 2.4, ease.outQuint(inv(ob.t, ob.t + 0.3, t)));
          drawFollowCircle(ctx, b.x, b.y, r, fs, ease.outQuint(inv(ob.t, ob.t + 0.3, t)), ob.color);
          drawSliderBall(ctx, b.x, b.y, r, ob.color, b.a, ease.outQuint(inv(ob.t, ob.t + 0.2, t)));
        }
      }
      if (t >= ob.t) drawHitBurst(ctx, ob.x, ob.y, r, ob.color, t - ob.t, ob.n, false);
      if (t >= ob.end) {
        const dt = t - ob.end;
        drawFollowCircle(ctx, ob.ex, ob.ey, r, lerp(2.4, 1, ease.outQuint(inv(0, 0.3, dt))), 1 - ease.outQuint(inv(0, 0.15, dt)), ob.color);
      }
    } else if (ob.type === 'spinner') drawSpinner(ctx, this, ob, t);
  }
}

// ---------- ArgonSpinner ----------
function arc(ctx, x, y, r, a0, a1, lw, color, alpha = 1) {
  if (alpha <= 0 || a1 <= a0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke(); ctx.restore();
}
function drawSpinner(ctx, map, o, t) {
  const pre = map.preempt, fadeIn = ease.outQuint(inv(o.t - pre, o.t - pre / 2, t));
  const out = inv(o.end, o.end + 0.32, t);
  const alpha = fadeIn * (1 - out);
  if (alpha <= 0) return;
  const discScale = t < o.t - pre * 0.75 ? 0.2 * ease.outQuint(inv(o.t - pre, o.t - pre * 0.75, t)) : lerp(0.2, 1, ease.outQuint(inv(o.t - pre * 0.75, o.t - pre * 0.25, t)));
  const R = o.R * discScale * (t > o.end ? lerp(1, 1.2, ease.outQuad(out)) : 1);
  const ang = map.spinAngle(o, t), spins = ang / TAU, prog = clamp(spins / o.need), done = prog >= 1;
  const tracking = t >= o.t && t <= o.end ? 1 : 0;
  const x = o.x, y = o.y, sc = map.sc;
  ctx.save(); ctx.globalAlpha *= alpha;
  // fill grows with progress
  const fillR = (R - 8) * lerp(0.1, 0.98, prog);
  disc(ctx, x, y, fillR, PAL.argonPink, tracking ? 0.4 : 0.2);
  glow(ctx, x, y, fillR * 1.2, PAL.argonPink, 0.25 * tracking);
  // 25 rotating ticks
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  for (let i = 0; i < 25; i++) {
    ctx.save(); ctx.rotate((-i / 25) * TAU - (120 * PI) / 180);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; roundRect(ctx, (R - 8) * 0.8, -2.5 * (R / 160), 30 * (R / 160), 5 * (R / 160), 2.5 * (R / 160)); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  // top/bottom ring arcs (close into a full ring when complete)
  const rf = done ? 0.5 : 0.31, rw = done ? 0.044 : 0.02;
  arc(ctx, x, y, R - R * rw / 2, -PI / 2 - rf * PI, -PI / 2 + rf * PI, R * rw, '#ffffff');
  arc(ctx, x, y, R - R * rw / 2, PI / 2 - rf * PI, PI / 2 + rf * PI, R * rw, '#ffffff');
  // side progress arcs
  const pf = 0.15, pw = R * 0.12;
  for (const side of [0, PI]) {
    arc(ctx, x, y, R - pw / 2, side - pf * PI, side + pf * PI, pw, 'rgba(255,255,255,0.25)', done ? 0 : 1);
    const p = done ? 0 : pf * prog;
    if (p > 0) { glow(ctx, x + Math.cos(side) * (R - pw / 2), y, pw * 2.2, PAL.glowCyan, 0.35); arc(ctx, x, y, R - pw / 2, side - p * PI, side + p * PI, pw, rgba(PAL.glowCyan)); }
  }
  // centre
  const cs = lerp(80, 40, tracking) * 0.5 * (R / 160);
  ring(ctx, x, y, cs, 3, '#ffffff', 0.9); disc(ctx, x, y, cs * 0.35, '#ffffff');
  ctx.restore();
  // counters: bonus above, spins per minute below
  const k = sc / 2;
  if (t >= o.t && t <= o.end + 0.3) {
    const rpm = Math.round((Math.min(1, (t - o.t) / o.ramp) * o.wmax / TAU) * 60 * (0.97 + 0.03 * noise1(t * 7)));
    const sa = clamp((t - o.t) / 0.3) * (1 - out);
    text(ctx, String(rpm), x, y + 60 * k * 2 + 4, { size: 28 * k * 2, weight: 600, align: 'center', baseline: 'middle', alpha: sa });
    text(ctx, 'SPINS PER MINUTE', x, y + 60 * k * 2 + 36 * k * 2 / 1.4, { size: 16 * k * 1.6, weight: 600, align: 'center', baseline: 'middle', alpha: sa * 0.9, spacing: 1 });
  }
  const total = Math.floor(spins);
  for (let s = o.need + 1; s <= total; s++) {
    const ts = map.spinTime(o, s), dt = t - ts, nextT = map.spinTime(o, s + 1);
    if (dt < 0 || (t >= nextT && s < total) || dt > 1.0) continue;
    const scl = lerp(1.5, 1, ease.outQuint(inv(0, 1, dt))), a = 1 - inv(0.6, 1.0, Math.max(0, t - o.end) + (t > o.end ? 0.6 : 0));
    ctx.save(); ctx.translate(x, y - 100 * k * 2); ctx.scale(scl, scl);
    text(ctx, String((s - o.need) * 1000), 0, 0, { size: 28 * k * 2, weight: 700, align: 'center', baseline: 'middle', alpha: a * (1 - out) });
    ctx.restore();
  }
}

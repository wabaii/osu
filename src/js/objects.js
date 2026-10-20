'use strict';
// osu! gameplay elements, redrawn in vector after the wiki references:
// hit circles, approach circles, sliders, spinners, follow points, judgements and the cursor.

// ---------- hit circle sprite (cached per combo colour) ----------
const RS = 128; // sprite radius
const _circ = new Map();
function circleSprite(color) {
  if (_circ.has(color)) return _circ.get(color);
  const S = Math.ceil(RS * 2.5), c = makeCanvas(S, S), g = c.getContext('2d'), m = S / 2, r = RS;
  // soft drop shadow
  let gr = g.createRadialGradient(m, m + 4, r * 0.85, m, m + 4, r * 1.2);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(m, m + 4, r * 1.2, 0, TAU); g.fill();
  // body
  gr = g.createLinearGradient(0, m - r, 0, m + r);
  gr.addColorStop(0, rgba(lighten(color, 0.22))); gr.addColorStop(1, rgba(darken(color, 0.18)));
  g.fillStyle = gr; g.beginPath(); g.arc(m, m, r * 0.92, 0, TAU); g.fill();
  // lazer "triangles" texture
  g.save(); g.beginPath(); g.arc(m, m, r * 0.9, 0, TAU); g.clip();
  const rr = rng(color.charCodeAt(1) * 31 + color.charCodeAt(3));
  for (let i = 0; i < 16; i++) {
    const s = lerp(r * 0.25, r * 1.0, rr()), x = m + (rr() - 0.5) * r * 2, y = m + (rr() - 0.4) * r * 2;
    g.globalAlpha = lerp(0.06, 0.2, rr());
    g.fillStyle = rr() < 0.65 ? '#ffffff' : '#000000';
    g.beginPath(); triPath(g, x, y, s); g.fill();
  }
  g.restore();
  // inner vignette for depth
  gr = g.createRadialGradient(m, m - r * 0.2, r * 0.2, m, m, r * 0.92);
  gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.7, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.28)');
  g.fillStyle = gr; g.beginPath(); g.arc(m, m, r * 0.92, 0, TAU); g.fill();
  // white border
  g.strokeStyle = '#ffffff'; g.lineWidth = r * 0.14; g.beginPath(); g.arc(m, m, r * 0.9, 0, TAU); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = r * 0.025; g.beginPath(); g.arc(m, m, r * 0.985, 0, TAU); g.stroke();
  _circ.set(color, c); return c;
}

function drawCircle(ctx, x, y, r, color, num, alpha = 1, scale = 1) {
  if (alpha <= 0) return;
  const sp = circleSprite(color), k = (r / RS) * scale, S = sp.width * k;
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.drawImage(sp, x - S / 2, y - S / 2, S, S);
  if (num != null && num !== '') {
    setFont(ctx, r * 0.86 * scale, 700);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillText(String(num), x, y + r * 0.06 * scale + 3);
    ctx.fillStyle = '#fff'; ctx.fillText(String(num), x, y + r * 0.06 * scale);
  }
  ctx.restore();
}

function drawApproach(ctx, x, y, r, color, k, alpha = 1) {
  // k: 0 at appear -> 1 at hit time
  const s = lerp(4, 1, k);
  ring(ctx, x, y, r * s * 0.92, r * 0.085, rgba(lighten(color, 0.3)), alpha * 0.95);
}

// hit burst: swell + fade, plus a flash and shock ring
function drawHitBurst(ctx, x, y, r, color, dt, num) {
  if (dt < 0 || dt > 0.45) return;
  const k = inv(0, 0.26, dt);
  drawCircle(ctx, x, y, r, color, num, (1 - k) * 0.9, 1 + 0.42 * ease.outQuad(k));
  const k2 = inv(0, 0.4, dt);
  ring(ctx, x, y, r * lerp(0.95, 2.1, ease.outCubic(k2)), r * 0.06 * (1 - k2) + 0.5, rgba(lighten(color, 0.5)), (1 - k2) * 0.8);
  glow(ctx, x, y, r * 2.4, lighten(color, 0.3), (1 - inv(0, 0.18, dt)) * 0.55);
}

function drawJudgement(ctx, x, y, kind, dt, r) {
  if (dt < 0 || dt > 0.62) return;
  const color = JUDGE[kind];
  const kIn = ease.outBack(inv(0, 0.14, dt));
  const a = 1 - inv(0.3, 0.62, dt);
  const s = r * 0.62;
  ctx.save();
  ctx.translate(x, y - r * 0.15 - dt * 28);
  ctx.scale(lerp(0.4, 1, kIn), lerp(0.4, 1, kIn));
  glow(ctx, 0, 0, s * 2.3, color, a * 0.35);
  if (kind === 0) {
    ctx.globalAlpha = a; ctx.strokeStyle = color; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.5); ctx.lineTo(s * 0.5, s * 0.5); ctx.moveTo(s * 0.5, -s * 0.5); ctx.lineTo(-s * 0.5, s * 0.5); ctx.stroke();
  } else {
    text(ctx, String(kind), 0, 0, { size: s, weight: 700, align: 'center', baseline: 'middle', color: rgba(lighten(color, 0.35)), alpha: a, shadow: { color: rgba(color, 0.9), blur: s * 0.35 } });
  }
  ctx.restore();
}

// ---------- paths for sliders ----------
class Path {
  constructor(pts, type = 'catmull', samples = 300) {
    this.ctrl = pts; this.type = type;
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
      let a0 = Math.atan2(a.y - cc.y, a.x - cc.x), a1 = Math.atan2(b.y - cc.y, b.x - cc.x), a2 = Math.atan2(c.y - cc.y, c.x - cc.x);
      const norm = v => ((v % TAU) + TAU) % TAU;
      const ccw = norm(a1 - a0) < norm(a2 - a0);
      let sweep = ccw ? norm(a2 - a0) : -norm(a0 - a2);
      for (let i = 0; i <= samples; i++) { const ang = a0 + sweep * (i / samples); raw.push({ x: cc.x + cc.r * Math.cos(ang), y: cc.y + cc.r * Math.sin(ang) }); }
    } else { // catmull-rom through points
      const P = [pts[0], ...pts, pts[pts.length - 1]];
      const per = Math.ceil(samples / (pts.length - 1));
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
    const seg = this.cum[j] - this.cum[i] || 1, k = (d - this.cum[i]) / seg;
    const p = this.pts[i], q = this.pts[j];
    return { x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k), a: Math.atan2(q.y - p.y, q.x - p.x) };
  }
  // tangent angle at the very end, pointing forwards
  endAngle() { const n = this.pts.length; const p = this.pts[n - 4] || this.pts[0], q = this.pts[n - 1]; return Math.atan2(q.y - p.y, q.x - p.x); }
  startAngle() { const p = this.pts[0], q = this.pts[3] || this.pts[1]; return Math.atan2(q.y - p.y, q.x - p.x); }
  trace(ctx, d0, d1) {
    const i0 = this.idx(d0), i1 = this.idx(d1);
    const a = this.at(d0); ctx.moveTo(a.x, a.y);
    for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(this.pts[i].x, this.pts[i].y);
    const b = this.at(d1); ctx.lineTo(b.x, b.y);
  }
}

let _scratch = null;
function drawSliderBody(ctx, path, d0, d1, r, color, alpha) {
  if (alpha <= 0 || d1 <= d0 + 0.01) return;
  if (!_scratch) _scratch = makeCanvas(W, H);
  const g = _scratch.getContext('2d');
  // bounding box of the visible part
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const i0 = path.idx(d0), i1 = path.idx(d1);
  for (let i = Math.max(0, i0 - 1); i <= Math.min(path.pts.length - 1, i1 + 1); i++) {
    const p = path.pts[i]; x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  const pad = r * 1.2 + 6;
  x0 = Math.max(0, Math.floor(x0 - pad)); y0 = Math.max(0, Math.floor(y0 - pad));
  x1 = Math.min(W, Math.ceil(x1 + pad)); y1 = Math.min(H, Math.ceil(y1 + pad));
  if (x1 <= x0 || y1 <= y0) return;
  g.clearRect(x0, y0, x1 - x0, y1 - y0);
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round';
  const stroke = (w, c) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); path.trace(g, d0, d1); g.stroke(); };
  stroke(r * 2.12, 'rgba(0,0,0,0.35)');
  stroke(r * 1.98, '#ffffff');
  const layers = 7;
  for (let i = 0; i < layers; i++) {
    const k = i / (layers - 1);
    stroke(r * lerp(1.76, 0.5, k), rgba(mix(darken(color, 0.62), darken(color, 0.12), Math.pow(k, 0.8))));
  }
  g.restore();
  ctx.save(); ctx.globalAlpha *= alpha;
  ctx.drawImage(_scratch, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  ctx.restore();
}

function drawReverseArrow(ctx, x, y, ang, r, alpha, t) {
  if (alpha <= 0) return;
  const s = r * 0.55 * (1 + 0.12 * pulse(t, 7));
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha *= alpha;
  ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.moveTo(s * 0.95, 0); ctx.lineTo(s * 0.05, -s * 0.72); ctx.lineTo(s * 0.05, -s * 0.3); ctx.lineTo(-s * 0.85, -s * 0.3);
  ctx.lineTo(-s * 0.85, s * 0.3); ctx.lineTo(s * 0.05, s * 0.3); ctx.lineTo(s * 0.05, s * 0.72); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawSliderBall(ctx, x, y, r, color, ang, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  disc(ctx, x, y, r * 0.86, '#ffffff');
  const gr = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.05, x, y, r * 0.8);
  gr.addColorStop(0, rgba(lighten(color, 0.55))); gr.addColorStop(1, rgba(darken(color, 0.15)));
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r * 0.74, 0, TAU); ctx.fill();
  // rolling stripe
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r * 0.74, 0, TAU); ctx.clip();
  ctx.translate(x, y); ctx.rotate(ang);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-r * 0.12, -r, r * 0.24, r * 2);
  ctx.restore();
  ctx.restore();
}

function drawFollowCircle(ctx, x, y, r, k, alpha) {
  if (alpha <= 0) return;
  const R = r * lerp(1.0, 2.15, k);
  ring(ctx, x, y, R, r * 0.12, '#FFB21C', alpha * 0.95);
  disc(ctx, x, y, R, '#FFB21C', alpha * 0.08);
  glow(ctx, x, y, R * 1.25, '#FF9A1F', alpha * 0.18);
}

function drawTick(ctx, x, y, r, alpha) {
  disc(ctx, x, y, r * 0.16, 'rgba(0,0,0,0.5)', alpha);
  disc(ctx, x, y, r * 0.12, '#ffffff', alpha);
}

function drawFollowPoint(ctx, x, y, ang, s, alpha) {
  if (alpha <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.globalAlpha *= alpha;
  ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.28; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-s * 0.35, -s * 0.55); ctx.lineTo(s * 0.25, 0); ctx.lineTo(-s * 0.35, s * 0.55); ctx.stroke();
  ctx.restore();
}

// ---------- cursor ----------
class CursorPath {
  constructor(seed = 7) { this.anchors = []; this.seed = seed; this.clicks = []; }
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
    const k0 = inv(a.t1, a.t1 + gap * (gap < 0.15 ? 1 : 0.86), t);
    const e = gap < 0.15 ? k0 : gap < 0.3 ? ease.inOutSine(k0) : ease.inOutCubic(k0);
    const dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1;
    const bend = Math.sin(e * PI) * L * 0.07 * (lo % 2 ? 1 : -1);
    return { x: p.x + dx * e - (dy / L) * bend, y: p.y + dy * e + (dx / L) * bend };
  }
  pressAge(t) {
    let last = -Infinity;
    for (const c of this.clicks) { if (c <= t) last = c; else break; }
    return t - last;
  }
}

let _trailDot = null;
function trailDot() {
  if (_trailDot) return _trailDot;
  const c = makeCanvas(64, 64), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,240,180,1)'); gr.addColorStop(0.35, 'rgba(255,200,60,0.85)'); gr.addColorStop(1, 'rgba(255,140,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (_trailDot = c);
}

function drawCursor(ctx, cp, t, o = {}) {
  const { scale = 1, alpha = 1, trail = true } = o;
  if (alpha <= 0) return;
  const p = cp.at(t);
  ctx.save(); ctx.globalAlpha *= alpha;
  if (trail) {
    const N = 64, dt = 1 / 400, dot = trailDot();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = N; i >= 1; i--) {
      const q = cp.at(t - i * dt), k = 1 - i / N;
      const r = 15 * scale * lerp(0.35, 1, k);
      ctx.globalAlpha = alpha * Math.pow(k, 1.6) * 0.5;
      ctx.drawImage(dot, q.x - r, q.y - r, 2 * r, 2 * r);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
  }
  const pa = cp.pressAge(t), press = pa < 0.18 ? 1 + 0.25 * (1 - ease.outCubic(inv(0, 0.18, pa))) : 1;
  const R = 19 * scale * press;
  glow(ctx, p.x, p.y, R * 2.6, '#FF9A1F', 0.45);
  const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
  gr.addColorStop(0, '#FFFDF0'); gr.addColorStop(0.45, '#FFE27A'); gr.addColorStop(0.85, '#FFB21C'); gr.addColorStop(1, '#FF8A00');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 2.5 * scale; ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, TAU); ctx.stroke();
  ctx.restore();
}

// ---------- beatmap: objects, combos, judgements, cues, cursor ----------
class Beatmap {
  constructor(o = {}) {
    this.r = o.r || 80; this.preempt = o.preempt || 0.75; this.fadeIn = o.fadeIn || this.preempt * 0.45;
    this.judge = o.judge !== false; this.sound = o.sound !== false; this.snaking = o.snaking !== false;
    this.objs = []; this.ci = (o.colorStart || 0) - 1; this.n = 0; this.colors = o.colors || COMBO;
    this.seed = o.seed || 1; this.followPoints = o.followPoints !== false; this.vol = o.vol || 1; this.judgeGap = o.judgeGap || 0;
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
    const path = new Path(pts, o.curve || 'catmull');
    const span = o.span, repeats = o.repeats || 0, dur = span * (repeats + 1);
    const s0 = path.at(0), s1 = repeats % 2 ? path.at(0) : path.at(path.len);
    const tickEvery = o.tickEvery || BEAT;
    const ticks = []; // distances along the path for one span
    for (let tt = tickEvery; tt < span - 0.01; tt += tickEvery) ticks.push((tt / span) * path.len);
    this.objs.push(Object.assign(this._base(t, o.nc), { type: 'slider', x: s0.x, y: s0.y, path, span, repeats, dur, end: t + dur, ex: s1.x, ey: s1.y, ticks, sound: o.sound || 'normal' }));
    return this;
  }
  spinner(t, end, x, y, R, o = {}) {
    this.objs.push(Object.assign(this._base(t, true), { type: 'spinner', x, y, R, end, ex: x, ey: y, wmax: o.wmax || (477 / 60) * TAU, ramp: o.ramp || 0.6, need: o.need || 12 }));
    this.n = 0; // next object starts a new combo
    return this;
  }
  ballAt(o, t) {
    const u = clamp((t - o.t) / o.span, 0, o.repeats + 1);
    const pass = Math.min(Math.floor(u), o.repeats), f = u - pass;
    const d = (pass % 2 === 0 ? f : 1 - f) * o.path.len;
    const p = o.path.at(d);
    return { x: p.x, y: p.y, a: p.a + (pass % 2 ? PI : 0), pass, f };
  }
  spinAngle(o, t) {
    const dt = clamp(t - o.t, 0, o.end - o.t);
    if (dt < o.ramp) return (o.wmax * dt * dt) / (2 * o.ramp);
    return (o.wmax * o.ramp) / 2 + o.wmax * (dt - o.ramp);
  }
  spinRadius(o, t) { return o.R * 0.5 + Math.sin(t * 3.1) * o.R * 0.05 + noise1(t * 5) * o.R * 0.05; }
  finalize() {
    const r = rng(this.seed);
    this.events = []; // every combo-incrementing event
    this.hits = [];   // clickable starts (for keys, error meter)
    let combo = 0;
    for (const o of this.objs) {
      o.err = (r() + r() + r() - 1.5) * 0.012;
      const pan = panOf(o.x);
      if (o.type === 'circle') {
        this.events.push({ t: o.t, x: o.x, y: o.y, o, kind: 'hit' });
        this.hits.push({ t: o.t, dur: 0.07, o });
        if (this.sound) cue(o.t, 'hit', { s: o.sound, pan, vol: this.vol });
      } else if (o.type === 'slider') {
        this.events.push({ t: o.t, x: o.x, y: o.y, o, kind: 'head' });
        this.hits.push({ t: o.t, dur: o.dur, o });
        if (this.sound) { cue(o.t, 'hit', { s: o.sound, pan, vol: this.vol }); cue(o.t, 'slide', { dur: +o.dur.toFixed(4), pan, vol: this.vol }); }
        for (let p = 0; p <= o.repeats; p++) {
          for (const d of o.ticks) {
            const tickT = o.t + p * o.span + ((p % 2 ? o.path.len - d : d) / o.path.len) * o.span;
            const q = o.path.at(d);
            this.events.push({ t: tickT, x: q.x, y: q.y, o, kind: 'tick' });
            if (this.sound) cue(tickT, 'tick', { pan: panOf(q.x), vol: this.vol });
          }
          const tEnd = o.t + (p + 1) * o.span, q = o.path.at(p % 2 ? 0 : o.path.len);
          this.events.push({ t: tEnd, x: q.x, y: q.y, o, kind: p === o.repeats ? 'tail' : 'repeat' });
          if (this.sound) cue(tEnd, 'hit', { s: p === o.repeats ? 'normal' : 'whistle', pan: panOf(q.x), vol: this.vol * 0.9 });
        }
      } else if (o.type === 'spinner') {
        this.hits.push({ t: o.t, dur: o.end - o.t, o });
        if (this.sound) {
          cue(o.t, 'spin', { dur: +(o.end - o.t).toFixed(4), ramp: o.ramp, vol: this.vol });
          cue(o.end, 'hit', { s: 'finish', pan: 0, vol: this.vol });
          const full = o.need, total = Math.floor(this.spinAngle(o, o.end) / TAU);
          for (let s = full + 1; s <= total; s++) cue(this._spinTime(o, s), 'spinbonus', { vol: this.vol * 0.8 });
        }
        this.events.push({ t: o.end, x: o.x, y: o.y, o, kind: 'spinend' });
      }
    }
    this.objs.forEach((o, i) => { const nx = this.objs[i + 1]; o.showJudge = !nx || nx.t - o.end >= (this.judgeGap || 0); });
    this.events.sort((a, b) => a.t - b.t);
    this.events.forEach(e => (e.combo = ++combo));
    // alternate keys like a real player
    this.hits.sort((a, b) => a.t - b.t);
    this.hits.forEach((h, i) => { h.key = i % 2; const nx = this.hits[i + 1]; if (h.o.type === 'circle' && nx) h.dur = Math.min(0.07, (nx.t - h.t) * 0.6); });
    // follow points
    this.fps = [];
    for (let i = 0; i < this.objs.length - 1; i++) {
      const a = this.objs[i], b = this.objs[i + 1];
      if (b.nc || a.type === 'spinner' || b.type === 'spinner') continue;
      const L = dist(a.ex, a.ey, b.x, b.y);
      if (L < this.r * 2.6) continue;
      const ang = Math.atan2(b.y - a.ey, b.x - a.ex), step = this.r * 0.85;
      for (let d = this.r * 1.3; d < L - this.r * 1.2; d += step) {
        const f = d / L;
        this.fps.push({ x: lerp(a.ex, b.x, f), y: lerp(a.ey, b.y, f), ang, tIn: lerp(a.end, b.t, f) - this.preempt * 0.9, tOut: lerp(a.end, b.t, f) });
      }
    }
    return this;
  }
  _spinTime(o, n) { // time at which spin count reaches n
    const ang = n * TAU, angRamp = (o.wmax * o.ramp) / 2;
    if (ang <= angRamp) return o.t + Math.sqrt((2 * o.ramp * ang) / o.wmax);
    return o.t + o.ramp + (ang - angRamp) / o.wmax;
  }
  comboAt(t) { let c = 0; for (const e of this.events) { if (e.t <= t) c = e.combo; else break; } return c; }
  lastEventBefore(t) { let l = null; for (const e of this.events) { if (e.t <= t) l = e; else break; } return l; }
  // cursor anchors from the map
  cursor(cp) {
    for (const o of this.objs) {
      if (o.type === 'circle') cp.point(o.t, o.x, o.y).click(o.t);
      else if (o.type === 'slider') { cp.seg(o.t, o.end, t => this.ballAt(o, t)).click(o.t); }
      else if (o.type === 'spinner') {
        cp.seg(o.t, o.end, t => { const a = this.spinAngle(o, t), rr = this.spinRadius(o, t); return { x: o.x + Math.cos(a - PI / 2) * rr, y: o.y + Math.sin(a - PI / 2) * rr }; }).click(o.t);
      }
    }
    return cp;
  }
  draw(ctx, t, o = {}) {
    const r = this.r, alphaMul = o.alpha == null ? 1 : o.alpha;
    if (alphaMul <= 0) return;
    ctx.save(); ctx.globalAlpha *= alphaMul;
    // follow points
    if (this.followPoints) for (const f of this.fps) {
      if (t < f.tIn || t > f.tOut + 0.25) continue;
      const a = t < f.tOut ? inv(f.tIn, f.tIn + 0.2, t) : 1 - inv(f.tOut, f.tOut + 0.25, t);
      const sh = t < f.tIn + 0.2 ? (1 - ease.outCubic(inv(f.tIn, f.tIn + 0.2, t))) * r * 0.4 : 0;
      drawFollowPoint(ctx, f.x - Math.cos(f.ang) * sh, f.y - Math.sin(f.ang) * sh, f.ang, r * 0.3, a * 0.75);
    }
    // bodies, latest first so earlier objects sit on top
    const vis = this.objs.filter(ob => t >= ob.t - this.preempt && t <= ob.end + 0.7);
    for (let i = vis.length - 1; i >= 0; i--) this._drawObj(ctx, vis[i], t);
    // approach circles on top
    for (const ob of vis) {
      if (ob.type === 'spinner' || t >= ob.t) continue;
      const k = inv(ob.t - this.preempt, ob.t, t), a = inv(ob.t - this.preempt, ob.t - this.preempt + this.fadeIn, t);
      drawApproach(ctx, ob.x, ob.y, r, ob.color, k, a);
    }
    // judgements
    if (this.judge) for (const ob of vis) {
      if (!ob.showJudge) continue;
      if (ob.type === 'circle') drawJudgement(ctx, ob.x, ob.y, 300, t - ob.t, r);
      else if (ob.type === 'slider') drawJudgement(ctx, ob.ex, ob.ey, 300, t - ob.end, r);
      else if (ob.type === 'spinner') drawJudgement(ctx, ob.x, ob.y + ob.R * 0.15, 300, t - ob.end, r * 1.6);
    }
    ctx.restore();
  }
  _drawObj(ctx, ob, t) {
    const r = this.r;
    const a = inv(ob.t - this.preempt, ob.t - this.preempt + this.fadeIn, t);
    if (ob.type === 'circle') {
      if (t < ob.t) drawCircle(ctx, ob.x, ob.y, r, ob.color, ob.n, a);
      else drawHitBurst(ctx, ob.x, ob.y, r, ob.color, t - ob.t, ob.n);
    } else if (ob.type === 'slider') {
      const P = ob.path;
      const out = t > ob.end ? 1 - inv(ob.end, ob.end + 0.22, t) : 1;
      const snake = this.snaking ? ease.outQuad(inv(ob.t - this.preempt, ob.t - this.preempt * 0.45, t)) : 1;
      if (out > 0) {
        drawSliderBody(ctx, P, 0, P.len * snake, r, ob.color, a * out);
        const b = t >= ob.t ? this.ballAt(ob, t) : null;
        // end caps
        if (snake > 0.98 && t < ob.end) {
          const curPass = b ? b.pass : 0;
          // end circle, plus the head end again while the ball still has to come back to it
          const endP = P.at(P.len);
          drawCircle(ctx, endP.x, endP.y, r, ob.color, null, a * out * 0.95);
          if (ob.repeats > 0 && t >= ob.t) drawCircle(ctx, ob.x, ob.y, r, ob.color, null, a * out);
          // reverse arrow where the current pass turns around
          if (curPass < ob.repeats) {
            const atEnd = curPass % 2 === 0, q = P.at(atEnd ? P.len : 0);
            drawReverseArrow(ctx, q.x, q.y, atEnd ? P.endAngle() + PI : P.startAngle(), r, a * out, t);
          }
          // ticks still ahead of the ball on the current pass
          for (const d of ob.ticks) {
            let show = true;
            if (b) {
              const fwd = b.pass % 2 === 0, bd = (fwd ? b.f : 1 - b.f) * P.len;
              show = fwd ? d > bd : d < bd;
            }
            if (show) { const q = P.at(d); drawTick(ctx, q.x, q.y, r, a * out); }
          }
        }
        if (t < ob.t) drawCircle(ctx, ob.x, ob.y, r, ob.color, ob.n, a);
        if (b && t <= ob.end) {
          const fk = ease.outBack(inv(ob.t, ob.t + 0.15, t));
          drawFollowCircle(ctx, b.x, b.y, r, fk, 1);
          drawSliderBall(ctx, b.x, b.y, r, ob.color, t * 9, 1);
        }
      }
      if (t >= ob.t) drawHitBurst(ctx, ob.x, ob.y, r, ob.color, t - ob.t, ob.n);
      if (t >= ob.end) {
        const dt = t - ob.end;
        drawFollowCircle(ctx, ob.ex, ob.ey, r, 1 + 0.3 * inv(0, 0.2, dt), 1 - inv(0, 0.2, dt));
        drawHitBurst(ctx, ob.ex, ob.ey, r, ob.color, dt, null);
      }
    } else if (ob.type === 'spinner') {
      drawSpinner(ctx, this, ob, t);
    }
  }
}

// ---------- spinner ----------
function drawSpinner(ctx, map, o, t) {
  const fadeIn = inv(o.t - 0.45, o.t - 0.05, t);
  const outK = inv(o.end, o.end + 0.35, t);
  const alpha = fadeIn * (1 - outK);
  if (alpha <= 0) return;
  const R = o.R * (1 + 0.12 * ease.outCubic(outK)) * lerp(0.85, 1, ease.outBack(fadeIn));
  const ang = map.spinAngle(o, t), spins = ang / TAU, prog = clamp(spins / o.need);
  const clearT = map._spinTime(o, o.need), cleared = t >= clearT;
  const x = o.x, y = o.y;
  ctx.save(); ctx.globalAlpha *= alpha;
  // body
  const gr = ctx.createRadialGradient(x, y, 0, x, y, R);
  gr.addColorStop(0, 'rgba(26,16,40,0.92)'); gr.addColorStop(1, 'rgba(46,28,70,0.92)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
  glow(ctx, x, y, R * 1.5, cleared ? PAL.blue : PAL.pink, 0.18 + 0.15 * pulse(t, 6));
  // metre (conic fill)
  const cg = ctx.createConicGradient(-PI / 2, x, y);
  cg.addColorStop(0, PAL.pink); cg.addColorStop(0.5, PAL.purpleLight); cg.addColorStop(1, PAL.blue);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 16; ctx.beginPath(); ctx.arc(x, y, R + 22, 0, TAU); ctx.stroke();
  ctx.strokeStyle = cg; ctx.lineCap = 'round'; ctx.lineWidth = 16;
  ctx.beginPath(); ctx.arc(x, y, R + 22, -PI / 2, -PI / 2 + TAU * prog); ctx.stroke();
  ctx.lineCap = 'butt';
  // rotating layers
  ctx.save(); ctx.translate(x, y);
  ctx.save(); ctx.rotate(ang);
  for (let i = 0; i < 12; i++) {
    ctx.save(); ctx.rotate((i / 12) * TAU); ctx.globalAlpha *= 0.35 + 0.25 * (i % 2);
    ctx.fillStyle = i % 3 === 0 ? PAL.pinkLight : '#ffffff';
    ctx.beginPath(); triPath(ctx, 0, -R * 0.78, R * 0.16, 0); ctx.fill(); ctx.restore();
  }
  ctx.restore();
  ctx.save(); ctx.rotate(-ang * 0.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 5; ctx.setLineDash([R * 0.06, R * 0.05]);
  ctx.beginPath(); ctx.arc(0, 0, R * 0.6, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
  ctx.save(); ctx.rotate(ang);
  for (let i = 0; i < 3; i++) { // swirl blades
    ctx.save(); ctx.rotate((i / 3) * TAU);
    const bg = ctx.createLinearGradient(0, 0, R * 0.45, 0);
    bg.addColorStop(0, rgba(cleared ? PAL.blue : PAL.pink, 0.95)); bg.addColorStop(1, rgba(cleared ? PAL.blue : PAL.pink, 0));
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(R * 0.3, -R * 0.28, R * 0.5, -R * 0.05);
    ctx.quadraticCurveTo(R * 0.25, -R * 0.06, 0, 0); ctx.fill(); ctx.restore();
  }
  ctx.restore();
  ctx.restore();
  ring(ctx, x, y, R, 5, '#ffffff', 0.85);
  disc(ctx, x, y, 12, '#ffffff'); ring(ctx, x, y, 20, 3, '#ffffff', 0.7);
  // spinner approach circle
  if (t < o.end) ring(ctx, x, y, R * (1 - inv(o.t, o.end, t)) * 0.98 + 4, 7, '#ffffff', 0.55);
  // texts
  const sa = win(t, o.t - 0.1, o.t + 0.1, o.t + 0.5, o.t + 0.8);
  if (sa > 0) {
    ctx.save(); ctx.translate(x, y + R * 0.38); const s = lerp(1.6, 1, ease.outBack(inv(o.t - 0.1, o.t + 0.15, t))); ctx.scale(s, s);
    text(ctx, 'SPIN!', 0, 0, { size: 96, weight: 900, italic: true, align: 'center', baseline: 'middle', color: PAL.yellow, alpha: sa, shadow: { color: 'rgba(255,170,0,0.8)', blur: 30 } });
    ctx.restore();
  }
  if (cleared && t < o.end + 0.35) {
    const k = inv(clearT, clearT + 0.25, t);
    ctx.save(); ctx.translate(x, y - R * 0.3); const s = lerp(1.8, 1, ease.outBack(k)); ctx.scale(s, s);
    text(ctx, 'Clear!', 0, 0, { size: 110, weight: 800, italic: true, align: 'center', baseline: 'middle', color: '#FFE45C', alpha: clamp(k * 2), shadow: { color: 'rgba(255,190,0,0.9)', blur: 34 } });
    ctx.restore();
    // bonus popups
    const total = Math.floor(spins);
    for (let s2 = o.need + 1; s2 <= total; s2++) {
      const ts = map._spinTime(o, s2), dt = t - ts;
      if (dt < 0 || dt > 0.6) continue;
      text(ctx, '+1,000', x, y + R * 0.62 - dt * 70, { size: 54, weight: 700, align: 'center', baseline: 'middle', color: '#ffffff', alpha: 1 - inv(0.3, 0.6, dt), shadow: { color: rgba(PAL.blue, 0.9), blur: 16 } });
    }
  }
  // rpm box
  const rpm = t < o.t ? 0 : Math.round((Math.min(1, (t - o.t) / o.ramp) * o.wmax / TAU) * 60 * (0.97 + 0.03 * noise1(t * 7)));
  const bw = 300, bh = 70, bx = x - bw / 2, by = y + R + 60;
  ctx.fillStyle = 'rgba(10,8,20,0.75)'; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 14); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.stroke();
  text(ctx, 'RPM', bx + 26, by + bh / 2 + 2, { size: 26, weight: 600, baseline: 'middle', color: rgba(PAL.pinkLight), spacing: 3 });
  text(ctx, String(rpm), bx + bw - 26, by + bh / 2 + 2, { size: 44, weight: 700, align: 'right', baseline: 'middle', color: '#fff' });
  ctx.restore();
}

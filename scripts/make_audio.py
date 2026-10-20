"""Synthesises the soundtrack: an original 160 BPM track plus osu!-style hitsounds.

Everything is generated from scratch with numpy/scipy (no samples). Hitsound timing comes from
build/cues.json, which `node scripts/render.mjs cues` exports from the animation itself, so every
click lands exactly on the frame where its circle is hit.

    python3 scripts/make_audio.py build/cues.json build/soundtrack.wav
"""
import json
import sys

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
BPM = 160
BEAT = 60 / BPM
BAR = 4 * BEAT
DUR = 56.0
N = int(DUR * SR)
rng = np.random.default_rng(727)


def T(bar, beat=0.0):
    return (bar * 4 + beat) * BEAT


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(n):
    return np.arange(n) / SR


# ---------------------------------------------------------------- buses
class Bus:
    def __init__(self):
        self.L = np.zeros(N + SR * 4)
        self.R = np.zeros(N + SR * 4)

    def add(self, x, t, gain=1.0, pan=0.0):
        """Mix mono (or (2, n) stereo) signal x in at time t with equal-power pan."""
        i = int(round(t * SR))
        if i < 0:
            x = x[..., -i:]
            i = 0
        if x.ndim == 1:
            a = (pan + 1) * np.pi / 4
            l, r = x * np.cos(a) * gain, x * np.sin(a) * gain
        else:
            l, r = x[0] * gain, x[1] * gain
        n = min(len(l), len(self.L) - i)
        if n <= 0:
            return
        self.L[i:i + n] += l[:n]
        self.R[i:i + n] += r[:n]

    def st(self):
        return np.stack([self.L, self.R])


def lp(x, fc, order=2):
    sos = signal.butter(order, min(fc, SR * 0.45), 'low', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)


def hp(x, fc, order=2):
    sos = signal.butter(order, fc, 'high', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], 'band', fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=-1)


def sweep_lp(x, f0, f1, block=256):
    """Low-pass with a cutoff gliding exponentially from f0 to f1 over the signal."""
    out = np.zeros_like(x)
    zi = None
    nb = int(np.ceil(x.shape[-1] / block))
    for b in range(nb):
        fc = f0 * (f1 / f0) ** (b / max(1, nb - 1))
        bcoef, acoef = signal.butter(2, min(fc, SR * 0.45), 'low', fs=SR)
        seg = x[..., b * block:(b + 1) * block]
        if zi is None:
            zi = np.zeros(x.shape[:-1] + (2,))
        y, zi = signal.lfilter(bcoef, acoef, seg, axis=-1, zi=zi)
        out[..., b * block:(b + 1) * block] = y
    return out


def polyblep(ph, dt):
    out = np.zeros_like(ph)
    m = ph < dt
    x = ph[m] / dt[m] if np.ndim(dt) else ph[m] / dt
    out[m] = x + x - x * x - 1
    m2 = ph > 1 - dt
    x = (ph[m2] - 1) / (dt[m2] if np.ndim(dt) else dt)
    out[m2] = x * x + x + x + 1
    return out


def saw(f, n, ph0=0.0):
    dt = np.full(n, f / SR) if np.ndim(f) == 0 else f / SR
    ph = (ph0 + np.cumsum(dt)) % 1.0
    return 2 * ph - 1 - polyblep(ph, dt)


def square(f, n, duty=0.5, ph0=0.0):
    dt = np.full(n, f / SR) if np.ndim(f) == 0 else f / SR
    ph = (ph0 + np.cumsum(dt)) % 1.0
    ph2 = (ph + 1 - duty) % 1.0
    return (2 * ph - 1 - polyblep(ph, dt)) - (2 * ph2 - 1 - polyblep(ph2, dt))


def sine(f, n, ph0=0.0):
    if np.ndim(f) == 0:
        return np.sin(2 * np.pi * (f * tt(n) + ph0))
    return np.sin(2 * np.pi * (np.cumsum(f) / SR + ph0))


def adsr(n, a=0.005, d=0.1, s=0.7, r=0.1, hold=None):
    """Envelope over n samples; the release starts at `hold` seconds (default: n - r)."""
    t = tt(n)
    hold = (n / SR - r) if hold is None else hold
    env = np.where(t < a, t / max(a, 1e-6), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-6)))
    rel = np.clip((t - hold) / max(r, 1e-6), 0, 1)
    return env * (1 - rel)


def noise(n):
    return rng.uniform(-1, 1, n)


# ---------------------------------------------------------------- drums
def kick():
    n = int(0.45 * SR)
    t = tt(n)
    f = 46 + 130 * np.exp(-t * 28) + 40 * np.exp(-t * 120)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 6.5)
    click = hp(noise(n), 2500) * np.exp(-t * 400) * 0.5
    return np.tanh(1.6 * (body + click)) * 0.95


def clap():
    n = int(0.45 * SR)
    t = tt(n)
    nz = bp(noise(n), 900, 5200)
    env = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022]):
        env += np.where(t >= off, np.exp(-(t - off) * (180 if k < 2 else 16)), 0)
    tone = np.sin(2 * np.pi * 210 * t) * np.exp(-t * 40) * 0.3
    return (nz * env + tone) * 0.8


def hat(open_=False):
    n = int((0.32 if open_ else 0.06) * SR)
    t = tt(n)
    metal = sum(square(f, n, 0.5) for f in (3140, 4170, 5310, 6870)) / 4
    x = hp(noise(n) * 0.7 + metal * 0.5, 7000)
    return x * np.exp(-t * (11 if open_ else 70)) * 0.55


def crash(dur=2.4):
    n = int(dur * SR)
    t = tt(n)
    metal = sum(square(f, n, 0.5) for f in (2870, 3610, 4730, 5520, 7110, 8450)) / 6
    x = hp(noise(n) * 0.8 + metal * 0.4, 4200)
    return x * np.exp(-t * 2.1) * np.minimum(1, t / 0.002) * 0.55


def snare():
    n = int(0.25 * SR)
    t = tt(n)
    x = bp(noise(n), 1500, 8000) * np.exp(-t * 22) + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5
    return x * 0.7


def riser(dur, f0=300, f1=6000):
    n = int(dur * SR)
    t = tt(n)
    x = sweep_lp(hp(noise(n), 200), f0, f1)
    k = t / dur
    return x * k ** 2 * 0.8


def boom():
    n = int(1.6 * SR)
    t = tt(n)
    f = 30 + 55 * np.exp(-t * 6)
    return np.tanh(2 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.4)) * 0.9


# ---------------------------------------------------------------- tonal instruments
CHORDS = [[55, 59, 62], [57, 61, 64], [57, 61, 66], [59, 62, 66]]   # G, A, F#m, Bm (D major)
ROOTS = [43, 45, 42, 47]


def chord_of(bar):
    if bar == 35:  # resolve the loop to the tonic for the ending
        return [57, 62, 66], 38
    return CHORDS[bar % 4], ROOTS[bar % 4]


def supersaw(m, dur, voices=7, detune=0.28, cutoff=5200):
    n = int(dur * SR)
    L = np.zeros(n)
    R = np.zeros(n)
    for v in range(voices):
        d = (v - (voices - 1) / 2) / ((voices - 1) / 2) * detune
        x = saw(mtof(m + d), n, rng.random())
        pan = (v / (voices - 1)) * 2 - 1
        a = (pan * 0.8 + 1) * np.pi / 4
        L += x * np.cos(a)
        R += x * np.sin(a)
    out = lp(np.stack([L, R]) / voices, cutoff)
    return out * adsr(n, 0.01, 0.3, 0.85, 0.08)


def pluck(m, dur=0.3, bright=4500):
    n = int(dur * SR)
    t = tt(n)
    x = saw(mtof(m), n) * 0.6 + saw(mtof(m + 0.1), n) * 0.4
    x = sweep_lp(x, bright, 400)
    return x * np.exp(-t * 9) * np.minimum(1, t / 0.002)


def pulse_arp(m, dur):
    n = int(dur * SR)
    t = tt(n)
    return square(mtof(m), n, 0.25) * np.exp(-t * 10) * np.minimum(1, t / 0.001) * 0.5


def lead_note(m, dur):
    n = int((dur + 0.12) * SR)
    t = tt(n)
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.15) / 0.2, 0, 1)
    f = mtof(m) * vib
    x = saw(f, n) * 0.5 + saw(f * 1.004, n) * 0.35 + square(f * 0.5, n, 0.5) * 0.25
    x = lp(x, 3800)
    return x * adsr(n, 0.008, 0.25, 0.7, 0.1, hold=dur)


def pad_chord(notes, dur, cutoff=1400):
    n = int(dur * SR)
    out = np.zeros((2, n))
    for m in notes:
        out += supersaw(m, dur, voices=5, detune=0.18, cutoff=cutoff) * 0.5
    t = tt(n)
    env = np.minimum(1, t / 0.35) * np.minimum(1, (dur - t) / 0.4).clip(0, 1)
    return out * env


def bass_note(m, dur, cutoff=900):
    n = int(dur * SR)
    t = tt(n)
    x = lp(saw(mtof(m), n), cutoff) * 0.7 + sine(mtof(m - 12), n) * 0.6
    return np.tanh(x * 1.3) * adsr(n, 0.004, 0.12, 0.8, 0.03)


# melody (beat offsets inside an 8-bar phrase, duration in beats, midi)
MEL = [
    (0, .75, 79), (.75, .75, 78), (1.5, .5, 76), (2, .5, 74), (2.5, 1, 76), (3.5, .5, 74),
    (4, .75, 76), (4.75, .75, 78), (5.5, .5, 81), (6, .5, 79), (6.5, 1.5, 78),
    (8, .75, 78), (8.75, .75, 76), (9.5, .5, 73), (10, .5, 76), (10.5, 1, 81), (11.5, .5, 78),
    (12, .75, 78), (12.75, .75, 76), (13.5, 2.5, 74),
    (16, .5, 74), (16.5, .5, 79), (17, .5, 83), (17.5, .75, 81), (18.25, .75, 79), (19, 1, 78),
    (20, .5, 76), (20.5, .5, 81), (21, .5, 85), (21.5, .75, 83), (22.25, .75, 81), (23, 1, 76),
    (24, .5, 78), (24.5, .5, 81), (25, .5, 85), (25.5, .5, 86), (26, .75, 85), (26.75, .75, 81), (27.5, .5, 78),
    (28, 1.5, 83), (29.5, .5, 81), (30, 2, 78),
]


# ---------------------------------------------------------------- hitsounds and UI sounds
def hs_normal():
    n = int(0.12 * SR)
    t = tt(n)
    x = (np.sin(2 * np.pi * 1650 * t) * np.exp(-t * 90) * 0.55 + np.sin(2 * np.pi * 820 * t) * np.exp(-t * 45) * 0.5
         + bp(noise(n), 2500, 9000) * np.exp(-t * 600) * 0.7)
    return x * 0.85


def hs_whistle():
    n = int(0.3 * SR)
    t = tt(n)
    f = 2100 * (1 + 0.01 * np.sin(2 * np.pi * 14 * t))
    w = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 11) * np.minimum(1, t / 0.01) * 0.3
    x = np.zeros(n)
    x[:int(0.12 * SR)] += hs_normal()
    return x + w


def hs_clap():
    c = clap() * 0.9
    c[:int(0.12 * SR)] += hs_normal()
    return c


def hs_finish():
    c = crash(2.0) * 1.1
    c[:int(0.12 * SR)] += hs_normal()
    return c


def tick_sound():
    n = int(0.05 * SR)
    t = tt(n)
    return np.sin(2 * np.pi * 3300 * t) * np.exp(-t * 120) * 0.3


def slide_sound(dur):
    n = int(dur * SR)
    t = tt(n)
    x = bp(noise(n), 900, 2600) * 0.12
    am = 1 + 0.25 * np.sin(2 * np.pi * (BPM / 60 * 2) * t)
    env = np.minimum(1, t / 0.05) * np.clip((dur - t) / 0.06, 0, 1)
    return x * am * env


def spin_sound(dur, ramp):
    n = int(dur * SR)
    t = tt(n)
    prog = np.clip(t / dur, 0, 1)
    rot = np.minimum(1, t / ramp)
    f = 180 + 900 * prog ** 0.8
    x = saw(f, n) * 0.5 + sine(f * 2, n) * 0.3
    x = lp(x, 2500)
    trem = 0.6 + 0.4 * np.sin(2 * np.pi * np.cumsum(8 * rot) / SR)
    env = np.minimum(1, t / 0.1) * np.clip((dur - t) / 0.05, 0, 1) * (0.3 + 0.7 * rot)
    return x * trem * env * 0.22


def spin_bonus():
    n = int(0.35 * SR)
    t = tt(n)
    return (np.sin(2 * np.pi * 1760 * t) + 0.6 * np.sin(2 * np.pi * 2640 * t)) * np.exp(-t * 12) * 0.22


def ui_hover():
    n = int(0.08 * SR)
    t = tt(n)
    return np.sin(2 * np.pi * (900 + 400 * t / 0.08) * t) * np.exp(-t * 50) * 0.4


def ui_click():
    n = int(0.25 * SR)
    t = tt(n)
    f = 1300 * np.exp(-t * 18) + 300
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 20) * 0.6 + bp(noise(n), 2000, 9000) * np.exp(-t * 300) * 0.6
    return x


def type_sound():
    n = int(0.04 * SR)
    t = tt(n)
    return (bp(noise(n), 2500, 7000) * np.exp(-t * 300) * 0.6 + np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 150) * 0.15)


def count_sound(k):
    n = int(0.5 * SR)
    t = tt(n)
    if k > 0:
        return np.sin(2 * np.pi * 880 * t) * np.exp(-t * 9) * 0.35 + np.sin(2 * np.pi * 1760 * t) * np.exp(-t * 20) * 0.1
    return sum(np.sin(2 * np.pi * mtof(m) * t) for m in (74, 78, 81, 86)) * np.exp(-t * 5) * 0.16


def whoosh(dur):
    n = int(dur * SR)
    t = tt(n)
    x = noise(n)
    out = np.zeros(n)
    block, zi = 256, np.zeros(2)
    for b in range(0, n, block):
        fc = 400 + 5000 * np.sin(np.pi * b / n) ** 2
        bc, ac = signal.butter(1, [fc * 0.5, min(fc * 1.6, 18000)], 'band', fs=SR)
        out[b:b + block], zi = signal.lfilter(bc, ac, x[b:b + block], zi=zi)
    return out * np.sin(np.pi * t / dur) ** 2 * 0.35


def tickup(dur):
    out = np.zeros(int((dur + 0.1) * SR))
    k, tcur = 0, 0.0
    while tcur < dur:
        p = tcur / dur
        n = int(0.03 * SR)
        t = tt(n)
        blip = np.sin(2 * np.pi * (900 + 1400 * p) * t) * np.exp(-t * 140) * 0.25
        i = int(tcur * SR)
        out[i:i + n] += blip[:len(out) - i]
        tcur += 0.07 * (1 - 0.6 * p)
        k += 1
    return out


def slam():
    b = boom() * 0.8
    c = crash(2.4)
    out = np.zeros(max(len(b), len(c)))
    out[:len(b)] += b
    out[:len(c)] += c
    n = int(1.2 * SR)
    t = tt(n)
    chord = sum(np.sin(2 * np.pi * mtof(m) * t) for m in (62, 66, 69, 74)) * np.exp(-t * 3) * 0.08
    out[:n] += chord
    return out


# ---------------------------------------------------------------- reverb / delay
def make_ir(dur=2.2, decay=2.6):
    n = int(dur * SR)
    t = tt(n)
    ir = np.stack([noise(n), noise(n)]) * np.exp(-t * decay)
    ir = lp(ir, 6000)
    ir[:, :int(0.018 * SR)] = 0
    return ir / np.sqrt(np.sum(ir ** 2) / 2)


def reverb(x, ir):
    return np.stack([signal.fftconvolve(x[0], ir[0])[:x.shape[1]], signal.fftconvolve(x[1], ir[1])[:x.shape[1]]])


def pingpong(x, delay, fb=0.45, taps=6):
    d = int(delay * SR)
    out = np.zeros_like(x)
    mono = (x[0] + x[1]) * 0.5
    for k in range(1, taps + 1):
        ch = (k - 1) % 2
        out[ch, d * k:] += mono[:-d * k] * fb ** k
    return lp(out, 5000)


# ---------------------------------------------------------------- arrangement
def sidechain(kicks, depth=0.75, rate=9.0):
    t = tt(len(Bus().L))
    env = np.ones_like(t)
    for k in kicks:
        i = int(k * SR)
        seg = t[i:i + int(0.5 * SR)] - k
        env[i:i + len(seg)] = np.minimum(env[i:i + len(seg)], 1 - depth * np.exp(-seg * rate))
    return env


def build(cues):
    drums, bass, chords, lead, arp, pad, fx, hits = (Bus() for _ in range(8))
    send = Bus()   # reverb send
    dsend = Bus()  # delay send

    K, CL, HC, HO, SN = kick(), clap(), hat(), hat(True), snare()
    kicks = []

    def sec(bar):
        if bar < 2:
            return 'intro'
        if bar < 4:
            return 'build'
        if bar < 8:
            return 'dropA'
        if bar < 12:
            return 'verse1'
        if bar < 16:
            return 'verse2'
        if bar < 20:
            return 'spin'
        if bar < 28:
            return 'kiai'
        if bar < 32:
            return 'results'
        return 'outro'

    for bar in range(36):
        s = sec(bar)
        ch, root = chord_of(bar)
        b0 = T(bar)
        full = s in ('dropA', 'kiai')
        # ---- drums
        kick_beats = []
        if s in ('dropA', 'kiai', 'verse1', 'verse2'):
            kick_beats = [0, 1, 2, 3]
        elif s == 'build' and bar == 2:
            kick_beats = [0, 1, 2, 3]
        elif s == 'build' and bar == 3:
            kick_beats = [0, 1, 2]
        elif s == 'spin':
            kick_beats = [0, 1, 2, 3] if bar < 19 else []
            if bar == 18:
                kick_beats = [0, 1, 2, 2.5, 3, 3.5]
        elif s == 'results':
            kick_beats = [0, 2] if bar < 31 else [0]
        if bar == 7:
            kick_beats = [0, 1, 2]
        for kb in kick_beats:
            drums.add(K, b0 + kb * BEAT, 0.95)
            kicks.append(b0 + kb * BEAT)
        if s in ('dropA', 'kiai', 'verse1', 'verse2', 'results') and not (bar == 7):
            for cb in (1, 3):
                drums.add(CL, b0 + cb * BEAT, 0.55 if full else 0.4, 0.05)
                send.add(CL, b0 + cb * BEAT, 0.25)
        if s in ('dropA', 'kiai', 'verse2', 'spin', 'results'):
            for i in range(16):
                v = [1, 0.35, 0.65, 0.35][i % 4] * (0.42 if full else 0.3)
                drums.add(HC, b0 + i * BEAT / 4, v, 0.3)
        if s == 'verse1':
            for i in range(8):
                drums.add(HC, b0 + i * BEAT / 2, 0.32 if i % 2 else 0.2, 0.3)
        if full or s == 'verse2':
            for i in range(4):
                drums.add(HO, b0 + (i + 0.5) * BEAT, 0.32, -0.3)
        # snare rolls into the drops
        if bar == 3:
            for i in range(8):
                drums.add(SN, b0 + i * BEAT / 4, 0.25 + 0.5 * i / 8, 0)
                send.add(SN, b0 + i * BEAT / 4, 0.2)
            for i in range(12):
                drums.add(SN, b0 + 2 * BEAT + i * BEAT / 8, 0.45 + 0.4 * i / 12, 0)
        if bar == 19:
            for i in range(14):
                drums.add(SN, b0 + i * BEAT / 4, 0.25 + 0.55 * i / 14, 0)
                send.add(SN, b0 + i * BEAT / 4, 0.15)
        if bar == 27:
            for i in range(8):
                drums.add(SN, b0 + 2 * BEAT + i * BEAT / 4, 0.3 + 0.4 * i / 8, 0)
        if bar in (4, 8, 12, 20, 24, 28):
            drums.add(crash(), b0, 0.7 if bar != 28 else 0.9)
            send.add(crash(), b0, 0.25)
        # ---- bass
        if full:
            for i in range(8):
                if i % 2 == 1:
                    bass.add(bass_note(root + (12 if i == 7 else 0), BEAT / 2 * 0.95, 1200), b0 + i * BEAT / 2, 0.55)
            bass.add(sine(mtof(root - 12), int(BAR * SR)) * adsr(int(BAR * SR), 0.01, 0.2, 0.9, 0.05), b0, 0.5)
        elif s in ('verse1', 'verse2'):
            for i in range(8):
                bass.add(bass_note(root, BEAT / 2 * 0.8, 700), b0 + i * BEAT / 2, 0.45 if i % 2 else 0.35)
        elif s == 'spin':
            if bar < 19:
                bass.add(bass_note(root, BAR * 0.98, 500), b0, 0.5)
        elif s == 'results':
            bass.add(bass_note(root, BAR * 0.98, 450), b0, 0.45)
        # ---- chords
        if full:
            for m in ch + [ch[0] + 12]:
                chords.add(supersaw(m, BAR, cutoff=6000 if s == 'kiai' else 5000), b0, 0.16)
            send.add(supersaw(ch[0] + 12, BAR), b0, 0.05)
        elif s in ('verse1', 'verse2', 'results'):
            for pb in (0, 0.75, 1.5, 2, 2.75, 3.5):
                for m in ch:
                    x = pluck(m + 12, 0.32)
                    chords.add(x, b0 + pb * BEAT, 0.16, -0.25)
                    send.add(x, b0 + pb * BEAT, 0.06)
        if s in ('intro', 'build', 'spin', 'results', 'outro'):
            if not (s == 'spin' and bar == 19) and bar != 35:
                cut = {'intro': 500 + 400 * bar, 'build': 1400 + 1200 * (bar - 2), 'spin': 1600, 'results': 1300, 'outro': max(500, 1600 - 250 * (bar - 32))}[s]
                p = pad_chord(ch + [ch[0] + 12], BAR + 0.3, cut)
                pad.add(p, b0, 0.5 if s != 'outro' else 0.55)
                send.add(p, b0, 0.15)
        if bar == 19:
            p = sweep_lp(pad_chord(ch + [ch[0] + 12], BAR * 0.75, 12000), 600, 9000)
            pad.add(p, b0, 0.55)
        # ---- arp
        if s in ('intro', 'build', 'verse2', 'spin', 'kiai', 'outro') and bar >= 1:
            tones = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24]
            order = [0, 1, 2, 3, 2, 1, 2, 3]
            g = {'intro': 0.14, 'build': 0.18, 'verse2': 0.16, 'spin': 0.16, 'kiai': 0.12, 'outro': 0.14}[s]
            for i in range(16):
                if s == 'spin' and bar == 19 and i >= 14:
                    break
                x = pulse_arp(tones[order[i % 8]], BEAT / 4 * 0.9)
                arp.add(x, b0 + i * BEAT / 4, g, 0.35 if i % 2 else -0.35)
                dsend.add(x, b0 + i * BEAT / 4, g * 0.4)
        # risers
        if bar == 3:
            fx.add(riser(BAR - BEAT / 2), b0, 0.45)
        if bar == 19:
            fx.add(riser(BAR - BEAT / 2, 400, 9000), b0, 0.45)
        if bar == 7:
            fx.add(riser(BAR / 2, 6000, 300)[::-1] * 0.6, b0 + BAR / 2, 0.3)
    # ---- lead
    for phrase_start, sec_name in ((T(4), 'dropA'), (T(20), 'kiai'), (T(32), 'outro')):
        for (sb, db, m) in MEL:
            if sec_name == 'dropA' and sb >= 16:
                continue
            if sec_name == 'outro' and sb >= 16:
                continue
            x = lead_note(m, db * BEAT * 0.95)
            g = 0.32 if sec_name != 'outro' else 0.2
            lead.add(x, phrase_start + sb * BEAT, g, 0.0)
            send.add(x, phrase_start + sb * BEAT, g * 0.35)
            dsend.add(x, phrase_start + sb * BEAT, g * (0.35 if sec_name != 'outro' else 0.6))
    # final chord + impacts
    fin = pad_chord([50, 57, 62, 66, 69], 4.5, 2500)
    pad.add(fin, T(35), 0.75)
    send.add(fin, T(35), 0.4)
    for t0 in (T(4), T(20), T(28)):
        fx.add(boom(), t0, 0.8)

    # ---- cues from the animation
    bank = {'normal': hs_normal(), 'whistle': hs_whistle(), 'clap': hs_clap(), 'finish': hs_finish()}
    for c in cues:
        t0, typ, pan, vol = c['t'], c['type'], c.get('pan', 0.0), c.get('vol', 1.0)
        if typ == 'hit':
            x = bank[c.get('s', 'normal')]
            hits.add(x, t0, 0.72 * vol, pan)
            if c.get('s') in ('finish', 'clap'):
                send.add(x, t0, 0.18 * vol, pan)
        elif typ == 'tick':
            hits.add(tick_sound(), t0, 0.7 * vol, pan)
        elif typ == 'slide':
            hits.add(slide_sound(c['dur']), t0, 0.9 * vol, pan)
        elif typ == 'spin':
            hits.add(spin_sound(c['dur'], c.get('ramp', 0.6)), t0, 1.0 * vol)
        elif typ == 'spinbonus':
            hits.add(spin_bonus(), t0, 0.9 * vol, 0)
            send.add(spin_bonus(), t0, 0.2)
        elif typ == 'hover':
            hits.add(ui_hover(), t0, 0.5, pan)
        elif typ == 'click':
            hits.add(ui_click(), t0, 0.7, pan)
        elif typ == 'type':
            hits.add(type_sound(), t0, 0.5, pan)
        elif typ == 'count':
            x = count_sound(c['n'])
            hits.add(x, t0, 0.8)
            send.add(x, t0, 0.3)
        elif typ == 'whoosh':
            hits.add(whoosh(c['dur']), t0 - c['dur'] * 0.5, 0.8, pan)
        elif typ == 'impact':
            pass  # covered by the music's boom on the drop
        elif typ == 'tickup':
            hits.add(tickup(c['dur']), t0, 0.7)
        elif typ == 'slam':
            x = slam()
            hits.add(x, t0, 0.8)
            send.add(x, t0, 0.3)

    # ---- mix
    sc = sidechain(kicks)
    ir = make_ir()
    mix = (drums.st() * 1.0 + bass.st() * sc * 0.9 + chords.st() * sc * 1.0 + lead.st() * 0.95
           + arp.st() * (0.5 + 0.5 * sc) + pad.st() * (0.6 + 0.4 * sc) + fx.st() * 0.8 + hits.st() * 1.0)
    mix += reverb(send.st(), ir) * 0.35
    mix += pingpong(dsend.st(), BEAT * 0.75, 0.42) * 0.6
    mix = hp(mix, 25)
    # gentle bus glue + limiter
    peak = np.max(np.abs(mix))
    mix = mix / peak * 1.25
    mix = np.tanh(mix) / np.tanh(1.25)
    mix = mix[:, :N]
    fade = int(1.5 * SR)
    mix[:, -fade:] *= np.linspace(1, 0, fade) ** 2
    return mix * 0.89


if __name__ == '__main__':
    cues_path = sys.argv[1] if len(sys.argv) > 1 else 'build/cues.json'
    out = sys.argv[2] if len(sys.argv) > 2 else 'build/soundtrack.wav'
    meta = json.load(open(cues_path))
    assert abs(meta['BPM'] - BPM) < 1e-6, 'BPM mismatch between animation and audio'
    mix = build(meta['cues'])
    wavfile.write(out, SR, (mix.T * 32767).astype(np.int16))
    print(f'wrote {out}: {mix.shape[1] / SR:.1f}s, {len(meta["cues"])} cues')

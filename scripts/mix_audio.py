"""Builds the soundtrack from official osu! audio, driven by the animation's cue list.

Music: nekodex - welcome to osu!, nekodex - circles!, cYsmix - triangles (osu-resources Tracks).
Sounds: the lazer "welcome" voice/piano/see ya, Argon hitsounds, and menu / song select / results
samples (osu-resources Samples). Everything is placed from build/cues.json, which
`node scripts/render.mjs cues` exports from the page, so each sound lands on the frame it belongs to.

Also writes build/spectrum.bin: per-frame FFT bands and amplitude of the final mix, which the
renderer uses to drive the logo visualiser and beat pulses (like lazer's LogoVisualisation).

    python3 scripts/mix_audio.py build/cues.json build/soundtrack.wav build/spectrum.bin
"""
import json
import os
import subprocess
import sys

import numpy as np
from scipy import signal
from scipy.ndimage import maximum_filter1d

SR = 44100
OFFICIAL = os.path.join(os.path.dirname(__file__), '..', 'build', 'official')
TRACK_FILES = {
    'welcome': 'tracks/welcome/welcome.ogg',
    'circles': 'tracks/circles/circles.ogg',
    'triangles': 'tracks/triangles/audio.mp3',
}
HIT_ADDITION = {'whistle': 'normal-hitwhistle', 'clap': 'normal-hitclap', 'finish': 'normal-hitfinish'}

_cache = {}


def load(rel):
    """Decode any official audio file to float32 stereo at SR (cached)."""
    if rel in _cache:
        return _cache[rel]
    path = os.path.join(OFFICIAL, rel)
    if not os.path.splitext(path)[1]:
        for ext in ('.wav', '.mp3', '.ogg'):
            if os.path.exists(path + ext):
                path += ext
                break
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                         check=True, capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T.copy()
    _cache[rel] = x
    return x


def sample(name):
    return load('samples/' + name)


def resample(x, rate):
    """Play x faster/slower by `rate` (scalar or per-output-sample array)."""
    if np.ndim(rate) == 0:
        if abs(rate - 1) < 1e-6:
            return x
        pos = np.arange(0, x.shape[1] - 1, rate)
    else:
        pos = np.cumsum(rate)
        pos = pos[pos < x.shape[1] - 1]
    i = pos.astype(int)
    f = pos - i
    return x[:, i] * (1 - f) + x[:, i + 1] * f


def loop_to(x, n, xfade=0.03):
    """Loop x to length n with short crossfades at the seams."""
    out = np.zeros((2, n), dtype=np.float32)
    k = int(xfade * SR)
    pos = 0
    while pos < n:
        seg = x[:, :min(x.shape[1], n - pos)].copy()
        if pos > 0:
            m = min(k, seg.shape[1])
            seg[:, :m] *= np.linspace(0, 1, m)
            out[:, pos - m:pos] *= np.linspace(1, 0, m)
        out[:, pos:pos + seg.shape[1]] += seg
        pos += max(1, x.shape[1] - k)
    return out


class Mix:
    def __init__(self, dur):
        self.buf = np.zeros((2, int((dur + 4) * SR)), dtype=np.float32)
        self.n = int(dur * SR)

    def add(self, x, t, gain=1.0, pan=0.0):
        i = int(round(t * SR))
        if i < 0:
            x, i = x[:, -i:], 0
        a = (pan + 1) * np.pi / 4
        gl, gr = np.cos(a) * np.sqrt(2), np.sin(a) * np.sqrt(2)
        m = min(x.shape[1], self.buf.shape[1] - i)
        if m <= 0:
            return
        self.buf[0, i:i + m] += x[0, :m] * gain * gl
        self.buf[1, i:i + m] += x[1, :m] * gain * gr


def envelope(n, fade_in, fade_out):
    env = np.ones(n, dtype=np.float32)
    a, b = int(fade_in * SR), int(fade_out * SR)
    if a > 0:
        env[:a] = np.linspace(0, 1, a) ** 2
    if b > 0:
        env[-b:] *= np.linspace(1, 0, b) ** 1.5
    return env


def build(meta):
    dur = meta['DURATION']
    music, sfx = Mix(dur), Mix(dur)
    for c in meta['cues']:
        t, typ = c['t'], c['type']
        vol, pan = c.get('vol', 1.0), c.get('pan', 0.0)
        if typ == 'music':
            x = load(TRACK_FILES[c['track']])
            a, b = int(c['from'] * SR), int(c['until'] * SR)
            seg = x[:, a:b] * envelope(b - a, c.get('fadeIn', 0), c.get('fadeOut', 0))
            music.add(seg, t, vol)
        elif typ == 'sample':
            sfx.add(resample(sample(c['name']), c.get('rate', 1.0)), t, vol, pan)
        elif typ == 'hit':
            s = c.get('s', 'normal')
            sfx.add(sample('Gameplay/Argon/normal-hitnormal'), t, 0.62 * vol, pan)
            if s in HIT_ADDITION:
                sfx.add(sample('Gameplay/Argon/' + HIT_ADDITION[s]), t, 0.55 * vol, pan)
        elif typ == 'tick':
            sfx.add(sample('Gameplay/Argon/normal-slidertick'), t, 0.45 * vol, pan)
        elif typ == 'slide':
            n = int(c['dur'] * SR)
            x = loop_to(sample('Gameplay/Argon/normal-sliderslide'), n) * envelope(n, 0.03, 0.05)
            sfx.add(x, t, 0.35 * vol, pan)
        elif typ == 'spin':
            # lazer raises spinnerspin's frequency with progress (0.5 + progress)
            n = int(c['dur'] * SR)
            base = loop_to(sample('Gameplay/Argon/spinnerspin'), int(n * 1.6) + SR)
            rate = 0.5 + np.linspace(0, 1, n)
            x = resample(base, rate)[:, :n]
            x = x * envelope(x.shape[1], 0.08, 0.06)
            sfx.add(x, t, 0.5 * vol)
        elif typ == 'spinbonus':
            sfx.add(resample(sample('Gameplay/Argon/spinnerbonus'), 1 + 0.02 * c.get('n', 0)), t, 0.6 * vol)
    mix = music.buf * 0.82 + sfx.buf
    mix = mix[:, :music.n]
    # gentle peak limiter (5ms look-around, 80ms release)
    peak = maximum_filter1d(np.abs(mix).max(axis=0), size=int(0.005 * SR))
    gain = np.minimum(1.0, 0.95 / np.maximum(peak, 1e-6))
    b, a = signal.butter(1, 1 / (0.08 * SR * np.pi), 'low')
    gain = np.minimum(gain, signal.filtfilt(b, a, gain))
    mix = mix * gain
    fade = int(0.8 * SR)
    mix[:, -fade:] *= np.linspace(1, 0, fade)
    return mix.astype(np.float32)


def spectrum(mix, fps, bands=64):
    """Per-frame log-spaced FFT bands (0-255) and amplitude, with lazer-like fall-off."""
    mono = mix.mean(axis=0)
    frames = int(mono.shape[0] / SR * fps)
    nfft = 2048
    win = np.hanning(nfft)
    freqs = np.fft.rfftfreq(nfft, 1 / SR)
    edges = np.geomspace(40, 16000, bands + 1)
    idx = [np.where((freqs >= edges[i]) & (freqs < edges[i + 1]))[0] for i in range(bands)]
    idx = [ix if len(ix) else np.array([np.argmin(abs(freqs - edges[i]))]) for i, ix in enumerate(idx)]
    spec = np.zeros((frames, bands), dtype=np.float32)
    amp = np.zeros(frames, dtype=np.float32)
    padded = np.pad(mono, (nfft, nfft))
    for f in range(frames):
        c = int(f / fps * SR) + nfft
        seg = padded[c - nfft // 2:c + nfft // 2] * win
        mag = np.abs(np.fft.rfft(seg)) / (nfft / 4)
        spec[f] = [mag[ix].max() for ix in idx]
        amp[f] = np.abs(padded[c - nfft // 2:c + nfft // 2]).max()
    db = 20 * np.log10(spec + 1e-6)
    lvl = np.clip((db + 50) / 50, 0, 1) ** 1.6
    lvl *= np.linspace(1.0, 1.35, bands)  # lift the highs a little, like lazer's visualiser
    # bars jump up instantly and decay smoothly
    out = np.zeros_like(lvl)
    decay = 0.0024 * 1000 / fps
    for f in range(frames):
        out[f] = np.maximum(lvl[f], (out[f - 1] - decay * (out[f - 1] + 0.03)) if f else lvl[f])
    out = np.clip(out, 0, 1)
    amp = np.clip(amp / max(1e-6, np.percentile(amp, 99)), 0, 1)
    return (out * 255).astype(np.uint8), (amp * 255).astype(np.uint8), frames, bands


if __name__ == '__main__':
    cues_path = sys.argv[1] if len(sys.argv) > 1 else 'build/cues.json'
    out_wav = sys.argv[2] if len(sys.argv) > 2 else 'build/soundtrack.wav'
    out_spec = sys.argv[3] if len(sys.argv) > 3 else 'build/spectrum.bin'
    meta = json.load(open(cues_path))
    mix = build(meta)
    pcm = (np.clip(mix.T, -1, 1) * 32767).astype('<i2').tobytes()
    import wave
    with wave.open(out_wav, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm)
    spec, amp, frames, bands = spectrum(mix, meta['FPS'])
    with open(out_spec, 'wb') as f:
        f.write(np.array([frames, bands], dtype='<u4').tobytes()); f.write(spec.tobytes()); f.write(amp.tobytes())
    print(f'wrote {out_wav} ({mix.shape[1] / SR:.1f}s, {len(meta["cues"])} cues) and {out_spec} ({frames} frames x {bands} bands)')

# Builds the film's soundtrack: synthesized score + narration + the real Hindi
# line, then muxes it onto silent.mp4. Usage: python mix.py <workDir> <out.mp4>
import json, subprocess, sys, os
import numpy as np
from scipy.io import wavfile
from scipy.ndimage import uniform_filter1d
from scipy.signal import butter, sosfilt

work, out = sys.argv[1], sys.argv[2]
tl = json.load(open(f"{work}/timeline.json"))
at, total = tl["at"], tl["total"]
SR = 48000
N = int((total + 0.5) * SR)
rng = np.random.default_rng(7)


def lp(x, hz):
    return sosfilt(butter(2, hz, "low", fs=SR, output="sos"), x)


def hp(x, hz):
    return sosfilt(butter(2, hz, "high", fs=SR, output="sos"), x)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def env_points(points):
    ts, vs = zip(*points)
    return np.interp(np.arange(N) / SR, ts, vs)


def pad_note(freq, dur):
    # Detuned soft saws, low-passed: a warm string-like pad.
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for det in (-0.12, 0.0, 0.11):
        phase = (t * freq * (1 + det / 100 * 1.2)) % 1.0
        y += 2 * phase - 1
    y /= 3
    a = np.minimum(1, t / min(1.4, dur / 2)) * np.minimum(1, (dur - t) / min(1.6, dur / 2))
    return y * a


# ---- Score: slow minor progression that opens up at the reveal ----
beat = 60 / 84
bar = beat * 4
prog = [[57, 60, 64], [53, 57, 60], [48, 55, 64], [55, 59, 62]]  # Am F C G
pad = np.zeros(N)
bars = int(total / bar) + 1
for b in range(bars):
    start = b * bar
    for nt in prog[b % 4]:
        y = pad_note(midi(nt), bar * 1.15)
        i = int(start * SR)
        j = min(N, i + len(y))
        pad[i:j] += y[: j - i]
pad = lp(pad, 1500) * 0.16

# Bass + pulse + soft high pluck come in as the story builds.
bass = np.zeros(N)
kick = np.zeros(N)
pluck = np.zeros(N)
kn = int(0.28 * SR)
kt = np.arange(kn) / SR
kick_s = np.sin(2 * np.pi * (46 * kt + 26 * (1 - np.exp(-kt * 26)) / 26)) * np.exp(-kt * 13)
for b in range(bars):
    roots = [45, 41, 36, 43]
    f = midi(roots[b % 4])
    for k in range(4):
        st = b * bar + k * beat
        i = int(st * SR)
        n = int(beat * 0.92 * SR)
        if i + n >= N:
            continue
        tt = np.arange(n) / SR
        bass[i:i + n] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * 2.2)
        if i + kn < N:
            kick[i:i + kn] += kick_s
    chord = prog[b % 4]
    for k in range(8):
        st = b * bar + k * beat / 2
        i = int(st * SR)
        n = int(0.5 * SR)
        if i + n >= N:
            continue
        nt = chord[(k * 2 + (k // 3)) % 3] + 24
        tt = np.arange(n) / SR
        pluck[i:i + n] += np.sin(2 * np.pi * midi(nt) * tt) * np.exp(-tt * 7)

# Sections: quiet hook, opens at the reveal, drops out for the worker's voice,
# builds through the product, peaks on the ask, resolves at the end.
pad_env = env_points([(0, 0), (1.5, .55), (at["reveal"], .8), (at["hindi"] - .4, .9), (at["hindi"], .12), (at["voice2"], .12), (at["voice2"] + 1, .9), (at["ask"], 1), (at["end"], 1), (total - 1.5, .6), (total, 0)])
bass_env = env_points([(0, 0), (at["reveal"] - .05, 0), (at["reveal"], .6), (at["hindi"] - .3, .6), (at["hindi"], 0), (at["voice2"] + .5, 0), (at["voice2"] + 1.5, .7), (at["trust"], .75), (at["trust"] + .5, .4), (at["scale"], .6), (at["ask"], .85), (at["close"], .85), (at["close"] + .5, .25), (at["end"], .5), (total - 1.5, .25), (total, 0)])
kick_env = env_points([(0, 0), (at["voice2"] + 9.3, 0), (at["voice2"] + 9.7, .55), (at["trust"], .55), (at["trust"] + .3, 0), (at["scale"] + 2.4, 0), (at["scale"] + 2.8, .6), (at["close"], .75), (at["close"] + .4, 0), (total, 0)])
pluck_env = env_points([(0, 0), (at["problem"] + 4.5, 0), (at["problem"] + 6, .35), (at["hindi"] - .3, .5), (at["hindi"], 0), (at["voice2"] + 1, 0), (at["voice2"] + 2, .5), (at["close"], .7), (at["end"] + 2, .25), (total, 0)])
music = pad * pad_env + lp(bass, 320) * bass_env * .2 + kick * kick_env * .3 + pluck * pluck_env * .05

# Impacts and risers on the big moments.
def impact(t, gain=1.0):
    n = int(2.4 * SR)
    tt = np.arange(n) / SR
    y = np.sin(2 * np.pi * (38 * tt + 30 * (1 - np.exp(-tt * 9)) / 9)) * np.exp(-tt * 2.6)
    y += lp(rng.standard_normal(n), 900) * np.exp(-tt * 5) * .5
    i = int(t * SR)
    j = min(N, i + n)
    music[i:j] += y[: j - i] * .32 * gain


def riser(t, dur=1.4, gain=1.0):
    n = int(dur * SR)
    x = np.linspace(0, 1, n)
    y = hp(rng.standard_normal(n), 2500) * x ** 3 * .05 * gain
    i = max(0, int((t - dur) * SR))
    music[i:i + n] += y[: N - i]


for t_, g in [(at["reveal"] + .35, 1), (at["voice2"] + 9.6, .7), (at["ask"] + 3.45, .9), (at["end"], 1)]:
    impact(t_, g)
    riser(t_, 1.3, g)

# ---- Voices ----
voice = np.zeros(N)
for id_ in ["hook", "problem", "reveal", "voice1", "voice2", "command", "acts", "stress", "trust", "scale", "ask", "close"]:
    sr, y = wavfile.read(f"{work}/vo48/{id_}.wav")
    y = y.astype(np.float64) / 32768
    i = int(at[id_] * SR)
    voice[i:i + len(y)] += y[: N - i]
sr, h = wavfile.read(f"{work}/hindi48.wav")
h = h.astype(np.float64) / 32768
# A little presence so the worker's line reads as a real moment on its own.
i = int(at["hindi"] * SR)
voice[i:i + len(h)] += h[: N - i] * .72

# Light polish on the narration: remove rumble, lift presence, even out peaks.
voice = hp(voice, 80)
voice = voice + hp(voice, 3000) * .18
peak = np.percentile(np.abs(voice[np.abs(voice) > 1e-4]), 99.5)
voice = np.tanh(voice / peak * 1.1) * .62

# Duck the score under speech.
act = uniform_filter1d(np.abs(voice), int(.05 * SR)) > .012
act = act.astype(np.float64)
k = int(.32 * SR)
act = uniform_filter1d(act, k)
duck = 1 - .68 * np.clip(act * 1.6, 0, 1)
mix = voice + music * duck
mix = mix / max(1e-6, np.abs(mix).max()) * .9

st = np.stack([mix, mix], 1)
# Slight stereo width for the score only.
w = int(.011 * SR)
wide = np.roll(music * duck, w) * .10
st[:, 0] += wide
st[:, 1] -= wide
st = np.clip(st, -1, 1)
wavfile.write(f"{work}/mix.wav", SR, (st * 32767).astype(np.int16))
print("speech-active share:", round(float((act > .5).mean()), 3), "music peak:", round(float(np.abs(music).max()), 3))

FF = os.path.join(os.environ["LOCALAPPDATA"], r"Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe")
subprocess.run([FF, "-y", "-v", "error", "-i", f"{work}/silent.mp4", "-i", f"{work}/mix.wav",
                "-af", "loudnorm=I=-15:TP=-1.5:LRA=9", "-ar", "48000", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k",
                "-movflags", "+faststart", "-shortest", out], check=True)
print("wrote", out)

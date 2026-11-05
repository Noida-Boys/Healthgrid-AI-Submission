# Soundtrack for the reel: the level audio, a tick on each result, Timbre's
# read-back, and a low music bed only on the closing section.
# Usage: python reel_mix.py <reelWorkDir> <out.mp4>
import json, os, subprocess, sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

work, out = sys.argv[1], sys.argv[2]
tl = json.load(open(f"{work}/timeline.json", encoding="utf-8"))
SR = 48000
N = int((tl["total"] + .3) * SR)
FF = os.path.join(os.environ["LOCALAPPDATA"], r"Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe")
voice = np.zeros(N)
fx = np.zeros(N)


def put(buf, y, t, g=1.0):
    i = int(t * SR)
    j = min(N, i + len(y))
    buf[i:j] += y[: j - i] * g


def load(p):
    sr, y = wavfile.read(p)
    assert sr == SR
    return y.astype(np.float64) / 32768


def tick():
    n = int(.42 * SR)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * 880 * t) * np.exp(-t * 14) * (t < .14) + np.sin(2 * np.pi * 1320 * (t - .1)) * np.exp(-np.maximum(t - .1, 0) * 11) * (t >= .1)) * .5


for lv in tl["levels"]:
    y = load(f"{work}/audio/{lv['id']}-speech.wav")
    put(voice, y / max(1e-6, np.abs(y).max()) * .85, lv["start"])
    put(fx, tick(), lv["start"] + lv["toCard"], .35)
    if lv["id"] == "l5":
        rb = load(f"{work}/audio/l5-readback48.wav")
        put(voice, rb / max(1e-6, np.abs(rb).max()) * .85, lv["start"] + lv["toCard"] + .5)

# Low bed from the map onward (Am F C G, soft), per the script.
at = tl["at"]
beat = 60 / 84
pad = np.zeros(N)
prog = [[45, 57, 60, 64], [41, 53, 57, 60], [36, 48, 55, 64], [43, 55, 59, 62]]
bar = beat * 4
b = 0
st = at["map"] - .3
while st < tl["total"]:
    n = int(bar * 1.15 * SR)
    t = np.arange(n) / SR
    env = np.minimum(1, t / .9) * np.minimum(1, (n / SR - t) / 1.0)
    for m in prog[b % 4]:
        f = 440 * 2 ** ((m - 69) / 12)
        y = sum(2 * ((t * f * (1 + d / 100)) % 1) - 1 for d in (-.14, 0, .12)) / 3
        put(pad, y * env, st)
    st += bar
    b += 1
pad = sosfilt(butter(2, 1300, "low", fs=SR, output="sos"), pad)
genv = np.interp(np.arange(N) / SR, [0, at["map"] - .3, at["map"] + .5, tl["total"] - 1, tl["total"]], [0, 0, .3, .3, 0])
MODE = sys.argv[3] if len(sys.argv) > 3 else "bed"
if MODE == "none":
    # Speech, ticks and the cooker only: room for a track added inside Instagram.
    music = np.zeros(N)
elif MODE == "beat":
    # Original upbeat track that gains a layer each level, cuts out for the
    # cooker at Level 5, and lands on that level's result.
    bpm = 126
    b16 = 60 / bpm / 4
    L = tl["levels"]
    root_seq = [45, 45, 41, 43]
    kick, hat, clap, bass, arp = [np.zeros(N) for _ in range(5)]
    rng = np.random.default_rng(3)
    kn = int(.26 * SR); kt = np.arange(kn) / SR
    ks = np.sin(2 * np.pi * (48 * kt + 40 * (1 - np.exp(-kt * 30)) / 30)) * np.exp(-kt * 12)
    hn = int(.05 * SR)
    hs = sosfilt(butter(2, 7000, "high", fs=SR, output="sos"), rng.standard_normal(hn)) * np.exp(-np.arange(hn) / SR * 90)
    cn = int(.16 * SR)
    cs = sosfilt(butter(2, [900, 4500], "bandpass", fs=SR, output="sos"), rng.standard_normal(cn)) * np.exp(-np.arange(cn) / SR * 24)
    steps = int(tl["total"] / b16) + 1
    for s in range(steps):
        t0 = s * b16
        i = int(t0 * SR)
        if s % 4 == 0:
            put(kick, ks, t0)
        if s % 2 == 1:
            put(hat, hs, t0)
        if s % 8 == 4:
            put(clap, cs, t0)
        bar_i = (s // 16) % 4
        r = root_seq[bar_i]
        if s % 2 == 0:
            n = int(b16 * 1.9 * SR); tt = np.arange(n) / SR
            f = 440 * 2 ** ((r - 24 - 69 + 12) / 12)
            put(bass, np.sign(np.sin(2 * np.pi * f * tt)) * np.exp(-tt * 5), t0)
        n = int(b16 * 1.6 * SR); tt = np.arange(n) / SR
        third = 3 if r in (45,) else 4
        nt = r + 24 + [0, third, 7, 12, 7, third, 0, 7][s % 8]
        put(arp, np.sin(2 * np.pi * 440 * 2 ** ((nt - 69) / 12) * tt) * np.exp(-tt * 9), t0)
    bass = sosfilt(butter(2, 500, "low", fs=SR, output="sos"), bass)

    def gate(points):
        return np.interp(np.arange(N) / SR, *zip(*points))

    s = [lv["start"] for lv in L]
    hit = s[4] + L[4]["toCard"]
    end = tl["total"]
    off = lambda a: [(a - .04, 1), (a, 0)]
    kg = gate([(0, 0), (s[1] - .04, 0), (s[1], 1), (s[4] - .04, 1), (s[4], 0), (hit - .04, 0), (hit, 1), (end - 1, 1), (end, 0)])
    hg = gate([(0, 0), (s[0] - .04, 0), (s[0], 1), (s[4] - .04, 1), (s[4], 0), (hit - .04, 0), (hit, 1), (end - 1, 1), (end, 0)])
    bg = gate([(0, 0), (s[2] - .04, 0), (s[2], 1), (s[4] - .04, 1), (s[4], 0), (hit - .04, 0), (hit, 1), (end - 1, 1), (end, 0)])
    ag = gate([(0, 0), (.3, .5), (s[3] - .04, .6), (s[3], 1), (s[4] - .04, 1), (s[4], 0), (hit - .04, 0), (hit, 1), (end - 1, 1), (end, 0)])
    cg = gate([(0, 0), (s[3] - .04, 0), (s[3], 1), (s[4] - .04, 1), (s[4], 0), (hit - .04, 0), (hit, 1), (end - 1, 1), (end, 0)])
    music = kick * kg * .5 + hat * hg * .1 + clap * cg * .22 + bass * bg * .2 + arp * ag * .11
    n = int(1.2 * SR); tt = np.arange(n) / SR
    put(music, np.sin(2 * np.pi * (40 * tt + 30 * (1 - np.exp(-tt * 10)) / 10)) * np.exp(-tt * 3.2), hit, .5)
    from scipy.ndimage import uniform_filter1d
    act = uniform_filter1d(np.abs(voice), int(.05 * SR)) > .012
    # Speech stays clear; the cooker section has no music at all.
    music *= 1 - .62 * np.clip(uniform_filter1d(act.astype(np.float64), int(.2 * SR)) * 1.6, 0, 1)
else:
    music = pad * genv
mix = voice + fx + music
mix = mix / np.abs(mix).max() * .9
wavfile.write(f"{work}/mix.wav", SR, (np.stack([mix, mix], 1) * 32767).astype(np.int16))
subprocess.run([FF, "-y", "-v", "error", "-i", f"{work}/silent.mp4", "-i", f"{work}/mix.wav", "-af", "loudnorm=I=-14:TP=-1.5:LRA=11", "-ar", "48000",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-movflags", "+faststart", "-shortest", out], check=True)
print("wrote", out)

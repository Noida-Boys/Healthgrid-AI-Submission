# Generates each reel level's speech with Gnani Timbre, runs it through the real
# /api/ai/voice pipeline, and reports the result. Writes WAVs + results.json.
# Usage: python reel_levels.py <outDir>
import base64, json, os, subprocess, sys, urllib.request
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
BASE = "http://localhost:3000"
FACILITY = "seloo-phc"
SR = 48000
FF = os.path.join(os.environ["LOCALAPPDATA"], r"Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1.2-full_build\bin\ffmpeg.exe")

LEVELS = [
    {"id": "l1", "label": "English", "text": "ORS 50, paracetamol 100", "ttsLang": "en-IN", "lang": "English", "code": "en",
     "expect": {"ors": 50, "paracetamol": 100}},
    {"id": "l2", "label": "Hindi", "text": "ओआरएस 50 बचा है, पैरासिटामोल 100", "ttsLang": "hi-IN", "lang": "Hindi", "code": "hi",
     "expect": {"ors": 50, "paracetamol": 100}},
    {"id": "l3", "label": "Marathi", "text": "ORS ची 50 पाकिटं उरली आहेत", "ttsLang": "mr-IN", "lang": "Marathi", "code": "mr",
     "expect": {"ors": 50}},
    {"id": "l4", "label": "Marathi + English", "text": "ORS ची 50 पाकिटं उरली आहेत, all the beds are full, आणि आज फक्त one doctor आला", "ttsLang": "mr-IN", "lang": "Marathi", "code": "mr",
     "expect": {"ors": 50, "beds": 10, "doctors": 1}},
    {"id": "l5", "label": "Marathi + cooker", "text": "ORS ची 20 पाकिटं उरली आहेत, आणि सगळे बेड भरले आहेत", "ttsLang": "mr-IN", "lang": "Marathi", "code": "mr",
     "expect": {"ors": 20, "beds": 10}, "cooker": True},
]


def post(path, body):
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def speak(text, lang):
    raw = post("/api/ai/speak", {"text": text, "language": lang})
    pcm = raw[raw.index(b"data") + 8:]
    y = np.frombuffer(pcm[: len(pcm) // 2 * 2], dtype=np.int16).astype(np.float64) / 32768
    return subprocess_resample(y)


def subprocess_resample(y):
    p = subprocess.run([FF, "-v", "error", "-f", "s16le", "-ar", "24000", "-ac", "1", "-i", "-",
                        "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,aresample=48000",
                        "-f", "s16le", "-"], input=(y * 32767).astype(np.int16).tobytes(), capture_output=True, check=True)
    return np.frombuffer(p.stdout, dtype=np.int16).astype(np.float64) / 32768


def cooker(n):
    """Simulated pressure-cooker whistle: steam hiss plus a wavering high tone."""
    rng = np.random.default_rng(11)
    t = np.arange(n) / SR
    f = 3100 + 180 * np.sin(2 * np.pi * 5.5 * t) + 60 * np.sin(2 * np.pi * 17 * t)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) + .4 * np.sin(4 * np.pi * np.cumsum(f) / SR)
    hiss = sosfilt(butter(2, [1800, 7000], "bandpass", fs=SR, output="sos"), rng.standard_normal(n))
    env = np.minimum(1, t / 0.7) * np.minimum(1, (t[-1] - t) / 0.5)
    return (tone * .55 + hiss * 1.1) * env


def rms(x):
    return float(np.sqrt(np.mean(x ** 2)))


results = []
for lv in LEVELS:
    speech = speak(lv["text"], lv["ttsLang"])
    speech = speech / max(1e-6, np.abs(speech).max()) * .8
    if lv.get("cooker"):
        pre, post_ = int(1.2 * SR), int(.8 * SR)
        n = pre + len(speech) + post_
        c = cooker(n)
        # Whistle runs under the whole sentence, 6 dB below the speech level.
        c = c / rms(c) * rms(speech) * 10 ** (-6 / 20)
        audio = c.copy()
        audio[pre:pre + len(speech)] += speech
        audio = audio / max(1e-6, np.abs(audio).max()) * .9
        lv["snrDb"] = 6
    else:
        audio = np.concatenate([np.zeros(int(.25 * SR)), speech, np.zeros(int(.25 * SR))])
    path = f"{out}/{lv['id']}.wav"
    wavfile.write(path, SR, (audio * 32767).astype(np.int16))
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    if len(b64) > 2_000_000:
        # The app itself records 16 kHz mono; match it for the API check.
        p = subprocess.run([FF, "-v", "error", "-i", path, "-ar", "16000", "-f", "wav", "-"], capture_output=True, check=True)
        b64 = base64.b64encode(p.stdout).decode()
    res = json.loads(post("/api/ai/voice", {"audioBase64": b64, "mimeType": "audio/wav", "facilityId": FACILITY, "lang": lv["lang"], "langCode": lv["code"]}))
    got = {}
    for u in res.get("updates", []):
        got[u.get("medicineId") or u["field"]] = u["value"]
    missing = {k: v for k, v in lv["expect"].items() if got.get(k) != v}
    extra = {k: v for k, v in got.items() if k not in lv["expect"]}
    ok = not missing and not extra and res.get("confidence", 0) >= .7
    results.append({**{k: lv[k] for k in ("id", "label", "text", "lang", "code")}, "seconds": round(len(audio) / SR, 2),
                    "pass": ok, "got": got, "missing": missing, "extra": extra, "confidence": res.get("confidence"),
                    "transcript": res.get("transcript"), "echo": res.get("echo"), "echoLang": res.get("echoLang"), "detected": res.get("stt", {}).get("detectedLanguage")})
    print(("PASS" if ok else "FAIL"), lv["id"], lv["label"], "| conf", res.get("confidence"), "|", got, "| missing", missing, "| extra", extra)
    print("   heard:", res.get("transcript"))
    print("   echo: ", res.get("echo"))

json.dump(results, open(f"{out}/results.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("passed", sum(r["pass"] for r in results), "of", len(results))

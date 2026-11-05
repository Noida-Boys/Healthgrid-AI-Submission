// Generates the pitch narration with Gnani Timbre through the running dev server.
// Usage: node scripts/pitch-video/tts.mjs <outDir>
import { readFileSync, writeFileSync, mkdirSync } from "fs";

const out = process.argv[2];
mkdirSync(out, { recursive: true });
const beats = JSON.parse(readFileSync(new URL("./narration.json", import.meta.url)));

for (const b of beats) {
  const res = await fetch("http://localhost:3000/api/ai/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: b.text, language: "en-IN" }),
  });
  if (!res.ok) throw new Error(`${b.id}: HTTP ${res.status} ${await res.text()}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(`${out}/${b.id}.wav`, buf);
  // 16-bit mono assumed by the request's audio_config; duration from the data chunk.
  const rate = buf.readUInt32LE(24), ch = buf.readUInt16LE(22), bits = buf.readUInt16LE(34);
  const dataAt = buf.indexOf("data");
  const secs = buf.readUInt32LE(dataAt + 4) / (rate * ch * (bits / 8));
  console.log(b.id.padEnd(8), secs.toFixed(2) + "s", `${rate}Hz`);
}

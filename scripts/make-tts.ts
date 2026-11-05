/* Generates the demo's spoken Hindi line via Gemini TTS and saves it as WAV
   (the file Chrome will feed to getUserMedia during the recording).
   Run: npx tsx --env-file=.env.local scripts/make-tts.ts */
import { writeFileSync } from "fs";
import { GoogleGenAI } from "@google/genai";
import { env } from "../lib/config";

const TEXT = "आज ओ आर एस का स्टॉक 50 बचा है, और पैरासिटामोल 100 है";
const OUT = "docs/demo/hindi-line.wav";

function wavFromPcm(pcm: Buffer, sampleRate = 24000): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

(async () => {
  const ai = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: TEXT,
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
    },
  });
  const data = res.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!data) throw new Error("no audio returned");
  writeFileSync(OUT, wavFromPcm(Buffer.from(data, "base64")));
  console.log("WROTE", OUT);
})();

/* End-to-end voice semantics test: synthesizes the problem sentences with
   Gemini TTS and runs them through /api/ai/voice, checking the parsed values
   against the live facility state.
   Run: npx tsx --env-file=.env.local scripts/test-voice.ts */
import { GoogleGenAI } from "@google/genai";
import { env } from "../lib/config";
import { getFacility } from "../lib/server/data";

const FACILITY = "anji-phc";

function wavFromPcm(pcm: Buffer, sampleRate = 24000): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

interface Case {
  name: string;
  speech: string;
  lang: string;
  expect: (u: { field: string; medicineId?: string; value: number }[], f: Awaited<ReturnType<typeof getFacility>>) => string[];
}

const CASES: Case[] = [
  {
    name: "consumed vs remaining (the screenshot bug)",
    speech: "Today 80 Paracetamol 500 mg tablets were used, and only 20 ORS sachets are left.",
    lang: "English",
    expect: (u, f) => {
      const errs: string[] = [];
      const para = u.find((x) => x.medicineId === "paracetamol");
      const ors = u.find((x) => x.medicineId === "ors");
      const cur = f!.inventory["paracetamol"].currentStock;
      if (!para) errs.push("missing paracetamol update");
      else if (para.value !== cur - 80) errs.push(`paracetamol=${para.value}, expected ${cur - 80} (${cur}−80)`);
      if (!ors) errs.push("missing ors update");
      else if (ors.value !== 20) errs.push(`ors=${ors.value}, expected 20`);
      return errs;
    },
  },
  {
    name: "beds occupied + stock (the dropped-update bug)",
    speech: "All the beds are occupied, and only 10 ORS sachets are left.",
    lang: "English",
    expect: (u, f) => {
      const errs: string[] = [];
      const beds = u.find((x) => x.field === "beds");
      const ors = u.find((x) => x.medicineId === "ors");
      if (!beds) errs.push("missing beds update");
      else if (beds.value !== f!.beds.total) errs.push(`beds=${beds.value}, expected ${f!.beds.total}`);
      if (!ors) errs.push("missing ors update");
      else if (ors.value !== 10) errs.push(`ors=${ors.value}, expected 10`);
      return errs;
    },
  },
  {
    name: "the Hindi demo line",
    speech: "आज सारे बेड भर गए हैं, और ओ आर एस के सिर्फ़ दस पैकेट बचे हैं",
    lang: "Hindi",
    expect: (u, f) => {
      const errs: string[] = [];
      const beds = u.find((x) => x.field === "beds");
      const ors = u.find((x) => x.medicineId === "ors");
      if (!beds) errs.push("missing beds update");
      else if (beds.value !== f!.beds.total) errs.push(`beds=${beds.value}, expected ${f!.beds.total}`);
      if (!ors) errs.push("missing ors update");
      else if (ors.value !== 10) errs.push(`ors=${ors.value}, expected 10`);
      return errs;
    },
  },
];

(async () => {
  const facility = await getFacility(FACILITY);
  if (!facility) throw new Error("facility not found");
  console.log(
    `Facility ${facility.name}: beds ${facility.beds.occupied}/${facility.beds.total}, ` +
      `paracetamol ${facility.inventory["paracetamol"].currentStock}, ors ${facility.inventory["ors"].currentStock}\n`,
  );
  const ai = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
  let failed = 0;

  for (const c of CASES) {
    const tts = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: c.speech,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
      },
    });
    const pcm = tts.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
    if (!pcm) throw new Error("TTS returned no audio");
    const audioBase64 = wavFromPcm(Buffer.from(pcm, "base64")).toString("base64");

    const res = await fetch("http://localhost:3000/api/ai/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audioBase64, mimeType: "audio/wav", facilityId: FACILITY, lang: c.lang }),
    });
    const body = await res.json();
    console.log(`### ${c.name}`);
    console.log(`   said:   "${c.speech}"`);
    if (!res.ok) {
      console.log(`   FAIL: HTTP ${res.status} — ${body.error}`);
      failed++;
      continue;
    }
    console.log(`   parsed: ${JSON.stringify(body.updates)}  conf=${body.confidence}`);
    console.log(`   echo:   ${body.echo}`);
    const errs = c.expect(body.updates, facility);
    if (errs.length) {
      failed++;
      errs.forEach((e) => console.log(`   FAIL: ${e}`));
    } else {
      console.log("   PASS");
    }
    console.log();
  }
  console.log(failed === 0 ? "ALL PASS" : `${failed} case(s) FAILED`);
  process.exit(failed === 0 ? 0 : 1);
})();

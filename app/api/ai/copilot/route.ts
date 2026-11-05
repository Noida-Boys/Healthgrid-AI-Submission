import type { Content } from "@google/genai";
import { generateWithFallback } from "@/lib/gemini";
import { declarations, executors } from "@/lib/server/copilot-tools";

const SYSTEM = `You are the Health Copilot inside HealthGrid AI, the district health command center for Wardha district, Maharashtra. Your user is the District Health Officer.

Rules:
- Answer ONLY from tool results. If you did not call a tool, you do not know the answer. Never invent numbers or facility names.
- When no specific facility is named, the question is district-wide. For patient demand, OPD, staffing need or future load questions call getPatientDemandForecast without a facilityId. Never ask a clarifying question that a tool call could answer.
- Forecast values must come from getPatientDemandForecast or the patientDemandForecast field returned by getFacility. State confidence when discussing future demand.
- Reply strictly in the language of the user's question: English to English; Hindi to Hindi; Marathi to Marathi. Mixed-language questions may receive a natural mixed-language answer. Medicine names may stay in English.
- Plain text only: no markdown, no asterisks, no headings. Short lines and simple dashes are fine.
- Be terse and operational: lead with the answer, cite the numbers, at most 120 words unless asked for detail.
- When a facility is in trouble, end with the single most useful next action.`;

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: ChatMessage[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const contents: Content[] = messages.slice(-12).map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  try {
    for (let hop = 0; hop < 5; hop++) {
      const res = await generateWithFallback({
        contents,
        config: {
          systemInstruction: SYSTEM,
          tools: [{ functionDeclarations: declarations }],
          // Tool dispatch doesn't need deliberation; thinking models otherwise
          // blow the latency budget on every hop.
          thinkingConfig: { thinkingBudget: 0 },
          abortSignal: AbortSignal.timeout(55_000),
        },
      });

      const calls = res.functionCalls ?? [];
      if (calls.length === 0) {
        return Response.json({ text: res.text ?? "" });
      }

      // Push the model's own content back verbatim: Gemini 3 requires the
      // thoughtSignature carried by its functionCall parts to be preserved.
      const modelContent = res.candidates?.[0]?.content;
      if (!modelContent) return Response.json({ text: res.text ?? "" });
      contents.push(modelContent);
      const responses = await Promise.all(
        calls.map(async (fc) => {
          const exec = executors[fc.name ?? ""];
          const result = exec ? await exec(fc.args ?? {}) : { error: `unknown tool ${fc.name}` };
          return { functionResponse: { name: fc.name, response: { result } } };
        }),
      );
      contents.push({ role: "user", parts: responses });
    }
    return Response.json({ text: "I could not complete that analysis. Please rephrase or narrow the question." });
  } catch (e) {
    console.error("copilot error:", e instanceof Error ? e.message : e);
    return Response.json(
      { text: "Copilot is momentarily unavailable. The map and facility panels remain live." },
      { status: 200 },
    );
  }
}

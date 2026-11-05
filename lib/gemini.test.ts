import { beforeEach, describe, expect, it, vi } from "vitest";

const geminiMocks = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: geminiMocks.generateContent };
  },
}));

vi.mock("./config", () => ({
  GEMINI_MODEL: "gemini-3-flash-preview",
    GEMINI_FALLBACK_MODEL: "gemini-3.1-flash-lite",
    env:() => "test-api-key",
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  delete process.env.GEMINI_MODEL_POOL;
});

describe("generateWithFallback", () => {
  it("rotates when Google reports that a model is no longer available", async () => {
    geminiMocks.generateContent
      .mockRejectedValueOnce(new Error('404 NOT_FOUND: model is no longer available'))
      .mockResolvedValueOnce({ text: "fallback response" });

    const { generateWithFallback } = await import("./gemini");
    const response = await generateWithFallback({ contents: "Why is Seloo critical?" });

    expect(response.text).toBe("fallback response");
    expect(geminiMocks.generateContent).toHaveBeenNthCalledWith(1, {
      model: "gemini-3-flash-preview",
      contents: "Why is Seloo critical?",
    });
    expect(geminiMocks.generateContent).toHaveBeenNthCalledWith(2, {
      model: "gemini-3.1-flash-lite",
      contents: "Why is Seloo critical?",
    });
  });
});

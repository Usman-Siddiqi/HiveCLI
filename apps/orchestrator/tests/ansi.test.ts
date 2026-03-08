import { describe, expect, it } from "vitest";

import { sanitizeFinalText } from "../src/utils/ansi";

describe("sanitizeFinalText", () => {
  it("removes ansi sequences and trims output", () => {
    const value = "\u001B[31merror\u001B[0m\r\nok\r\n";
    expect(sanitizeFinalText(value)).toBe("error\nok");
  });

  it("extracts the final codex answer from the terminal transcript", () => {
    const value = [
      "OpenAI Codex v0.98.0 (research preview)",
      "--------",
      "user",
      "What is the meaning of life?",
      "codex",
      "The meaning of life is the meaning you create through how you live.",
      "tokens used",
      "8,315",
    ].join("\n");

    expect(sanitizeFinalText(value, "codex")).toBe(
      "The meaning of life is the meaning you create through how you live.",
    );
  });

  it("drops trailing codex diagnostics after the final answer", () => {
    const value = [
      "Hive",
      "2026-03-08T21:04:11.830146Z  WARN codex_protocol::openai_models: Model personality requested but model_messages is missing, falling back to base instructions.",
      "model=gpt-5.1-codex-mini personality=pragmatic",
    ].join("\n");

    expect(sanitizeFinalText(value, "codex")).toBe("Hive");
  });
});

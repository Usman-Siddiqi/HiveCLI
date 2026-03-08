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
});

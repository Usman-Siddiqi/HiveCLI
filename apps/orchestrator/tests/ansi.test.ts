import { describe, expect, it } from "vitest";

import { sanitizeFinalText } from "../src/utils/ansi";

describe("sanitizeFinalText", () => {
  it("removes ansi sequences and trims output", () => {
    const value = "\u001B[31merror\u001B[0m\r\nok\r\n";
    expect(sanitizeFinalText(value)).toBe("error\nok");
  });
});

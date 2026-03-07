import stripAnsi from "strip-ansi";

export function sanitizeFinalText(value: string) {
  return stripAnsi(value).replace(/\r\n/g, "\n").trim();
}

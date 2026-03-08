import stripAnsi from "strip-ansi";

function extractCodexFinalText(value: string) {
  const marker = "\ncodex\n";
  const markerIndex = value.lastIndexOf(marker);
  if (markerIndex === -1) {
    return value.trim();
  }

  const afterMarker = value.slice(markerIndex + marker.length);
  const tokensIndex = afterMarker.indexOf("\ntokens used\n");
  if (tokensIndex >= 0) {
    const candidate = afterMarker.slice(0, tokensIndex).trim();
    if (candidate) {
      return candidate;
    }
  }

  return afterMarker.trim();
}

export function sanitizeFinalText(value: string, provider?: string) {
  const normalized = stripAnsi(value).replace(/\r\n/g, "\n").trim();

  if (provider === "codex") {
    return extractCodexFinalText(normalized);
  }

  return normalized;
}

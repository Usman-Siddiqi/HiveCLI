import stripAnsi from "strip-ansi";

function stripTrailingCodexDiagnostics(value: string) {
  const lines = value.split("\n");
  const diagnosticIndex = lines.findIndex((line) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\s+(?:WARN|ERROR|INFO)\b/.test(line.trim()),
  );

  if (diagnosticIndex === -1) {
    return value.trim();
  }

  return lines.slice(0, diagnosticIndex).join("\n").trim();
}

function extractCodexFinalText(value: string) {
  const marker = "\ncodex\n";
  const markerIndex = value.lastIndexOf(marker);
  if (markerIndex === -1) {
    return stripTrailingCodexDiagnostics(value);
  }

  const afterMarker = value.slice(markerIndex + marker.length);
  const tokensIndex = afterMarker.indexOf("\ntokens used\n");
  if (tokensIndex >= 0) {
    const candidate = afterMarker.slice(0, tokensIndex).trim();
    if (candidate) {
      return stripTrailingCodexDiagnostics(candidate);
    }
  }

  return stripTrailingCodexDiagnostics(afterMarker);
}

export function sanitizeFinalText(value: string, provider?: string) {
  const normalized = stripAnsi(value).replace(/\r\n/g, "\n").trim();

  if (provider === "codex") {
    return extractCodexFinalText(normalized);
  }

  return normalized;
}

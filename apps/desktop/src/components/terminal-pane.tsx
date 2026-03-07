import { useEffect, useRef } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";

export function TerminalPane({ output }: { output: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const lastValueRef = useRef("");

  useEffect(() => {
    if (!containerRef.current || terminalRef.current) {
      return;
    }

    const terminal = new Terminal({
      convertEol: true,
      fontFamily: "IBM Plex Mono, Consolas, monospace",
      fontSize: 12,
      theme: {
        background: "#0f0e0c",
        foreground: "#ede4d8",
        cursor: "#c48b3b",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    fitAddon.fit();
    terminalRef.current = terminal;

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      lastValueRef.current = "";
    };
  }, []);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    if (!output.startsWith(lastValueRef.current)) {
      terminal.clear();
      terminal.write(output);
      lastValueRef.current = output;
      return;
    }

    const nextChunk = output.slice(lastValueRef.current.length);
    if (nextChunk) {
      terminal.write(nextChunk);
      lastValueRef.current = output;
    }
  }, [output]);

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)]">
      <div className="border-b border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--muted)]">
        Live transcript
      </div>
      <div ref={containerRef} className="h-[220px] w-full overflow-hidden bg-[#0f0e0c]" />
    </section>
  );
}

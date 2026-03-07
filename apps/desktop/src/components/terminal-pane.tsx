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
    const safeFit = () => {
      try {
        fitAddon.fit();
      } catch {
        // xterm can briefly report incomplete dimensions during first paint.
      }
    };

    terminal.loadAddon(fitAddon);
    terminal.open(containerRef.current);
    requestAnimationFrame(safeFit);
    terminalRef.current = terminal;

    const resizeObserver = new ResizeObserver(() => safeFit());
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
    <div ref={containerRef} className="h-full w-full overflow-hidden bg-[#0f0e0c]" />
  );
}

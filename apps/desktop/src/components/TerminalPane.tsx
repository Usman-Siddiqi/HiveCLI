import { useEffect, useRef } from "react";

import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";

interface TerminalPaneProps {
  content: string;
}

export function TerminalPane({ content }: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const previousContentRef = useRef("");

  useEffect(() => {
    if (!hostRef.current || terminalRef.current) {
      return;
    }

    const terminal = new Terminal({
      theme: {
        background: "#0b1014",
        foreground: "#d6e0e7",
        brightGreen: "#75f7d7",
        brightRed: "#ff8266",
      },
      fontFamily: "IBM Plex Mono, monospace",
      fontSize: 12,
      cursorBlink: true,
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(hostRef.current);
    fit.fit();

    terminalRef.current = terminal;
    fitRef.current = fit;

    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
    });
    resizeObserver.observe(hostRef.current);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, []);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }

    if (!content.startsWith(previousContentRef.current)) {
      terminal.reset();
      terminal.write(content.replace(/\n/g, "\r\n"));
      previousContentRef.current = content;
      fitRef.current?.fit();
      return;
    }

    const delta = content.slice(previousContentRef.current.length);
    if (delta) {
      terminal.write(delta.replace(/\n/g, "\r\n"));
      previousContentRef.current = content;
    }
  }, [content]);

  return <div className="h-64 rounded-[1.5rem] border border-line bg-[#0b1014] p-2" ref={hostRef} />;
}

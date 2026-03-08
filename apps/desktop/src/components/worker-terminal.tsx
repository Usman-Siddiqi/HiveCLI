import { Cpu } from "lucide-react";

import { TerminalPane } from "./terminal-pane";

interface WorkerTerminalProps {
    label: string;
    agentName: string;
    status: string;
    content: string;
    workingDir?: string;
}

export function WorkerTerminal({ label, agentName, status, content, workingDir }: WorkerTerminalProps) {
    return (
        <section className="hive-panel role-worker" data-testid={`panel-${label.toLowerCase().replace(/\s+/g, "-")}`}>
            <header className="hive-panel-header">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-[var(--accent-secondary)]" />
                        <span className="hive-panel-label">{label}</span>
                        <span className="text-xs text-[var(--muted)]">{agentName}</span>
                    </div>
                    <div className="hive-panel-meta" data-testid={`path-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                        {workingDir ?? "Waiting for assigned worker folder…"}
                    </div>
                </div>
                <StatusDot status={status} label={label} />
            </header>
            <div className="hive-panel-body">
                <TerminalPane output={content} />
            </div>
        </section>
    );
}

function StatusDot({ status, label }: { status: string; label: string }) {
    const color =
        status === "running"
            ? "bg-emerald-400 animate-pulse"
            : status === "completed"
                ? "bg-emerald-500"
                : status === "failed"
                    ? "bg-red-400"
                    : "bg-zinc-600";

    return (
        <div className="flex items-center gap-2" data-testid={`status-${label.toLowerCase().replace(/\s+/g, "-")}`}>
            <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
            <span className="text-xs capitalize text-[var(--muted)]">{status}</span>
        </div>
    );
}

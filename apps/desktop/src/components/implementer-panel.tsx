import { Wrench } from "lucide-react";

import { TerminalPane } from "./terminal-pane";

interface ImplementerPanelProps {
    agentName: string;
    status: string;
    content: string;
}

export function ImplementerPanel({ agentName, status, content }: ImplementerPanelProps) {
    return (
        <section className="hive-panel role-implementer" data-testid="panel-implementer">
            <header className="hive-panel-header">
                <div className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-[var(--implement)]" />
                    <span className="hive-panel-label">Implementer</span>
                    <span className="text-xs text-[var(--muted)]">{agentName}</span>
                </div>
                <StatusDot status={status} />
            </header>
            <div className="hive-panel-body">
                {content ? (
                    <TerminalPane output={content} />
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                        Waiting for judge verdict to implement…
                    </div>
                )}
            </div>
        </section>
    );
}

function StatusDot({ status }: { status: string }) {
    const color =
        status === "running"
            ? "bg-violet-400 animate-pulse"
            : status === "completed"
                ? "bg-violet-500"
                : status === "failed"
                    ? "bg-red-400"
                    : "bg-zinc-600";

    return (
        <div className="flex items-center gap-2" data-testid="status-implementer">
            <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
            <span className="text-xs capitalize text-[var(--muted)]">{status}</span>
        </div>
    );
}

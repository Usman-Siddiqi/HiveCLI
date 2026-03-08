import { Scale } from "lucide-react";

import { TerminalPane } from "./terminal-pane";

interface JudgePanelProps {
    agentName: string;
    status: string;
    content: string;
    workingDir?: string;
}

export function JudgePanel({ agentName, status, content, workingDir }: JudgePanelProps) {
    return (
        <section className="hive-panel role-judge" data-testid="panel-judge">
            <header className="hive-panel-header">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <Scale className="h-4 w-4 text-[var(--accent)]" />
                        <span className="hive-panel-label">Judge</span>
                        <span className="text-xs text-[var(--muted)]">{agentName}</span>
                    </div>
                    <div className="hive-panel-meta" data-testid="path-judge">
                        {workingDir ?? "Waiting for comparison artifacts…"}
                    </div>
                </div>
                <StatusDot status={status} />
            </header>
            <div className="hive-panel-body">
                {content ? (
                    <TerminalPane output={content} />
                ) : (
                    <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
                        Waiting for worker outputs to evaluate…
                    </div>
                )}
            </div>
        </section>
    );
}

function StatusDot({ status }: { status: string }) {
    const color =
        status === "running"
            ? "bg-amber-400 animate-pulse"
            : status === "completed"
                ? "bg-amber-500"
                : status === "failed"
                    ? "bg-red-400"
                    : "bg-zinc-600";

    return (
        <div className="flex items-center gap-2" data-testid="status-judge">
            <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
            <span className="text-xs capitalize text-[var(--muted)]">{status}</span>
        </div>
    );
}

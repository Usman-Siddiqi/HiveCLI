import { Shield, TerminalSquare } from "lucide-react";

export function StatusBar({
  selectedCount,
  judgeName,
}: {
  selectedCount: number;
  judgeName?: string;
}) {
  return (
    <div className="panel mt-4 rounded-[24px] px-4 py-3">
      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
        <span className="flex items-center gap-2">
          <TerminalSquare className="h-4 w-4 text-[var(--accent-secondary)]" />
          {selectedCount} agents armed for next task
        </span>
        <span className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[var(--warning)]" />
          Judge: {judgeName ?? "Not selected"}
        </span>
      </div>
    </div>
  );
}

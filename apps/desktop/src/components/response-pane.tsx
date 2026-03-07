export function ResponsePane({ text }: { text?: string | null }) {
  return (
    <div className="h-[260px] overflow-auto rounded-2xl border border-[var(--border)] bg-black/10 p-4 text-sm leading-6 text-[var(--text)]">
      {text?.trim() ? text : <span className="text-[var(--muted)]">No final response yet.</span>}
    </div>
  );
}

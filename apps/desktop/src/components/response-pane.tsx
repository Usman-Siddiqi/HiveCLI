export function ResponsePane({ text }: { text?: string | null }) {
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-strong)]">
      <div className="border-b border-[var(--border)] px-4 py-2 text-xs font-medium text-[var(--muted)]">
        Final response
      </div>
      <div className="h-[220px] overflow-auto p-4 text-sm leading-6 text-[var(--text)]">
        {text?.trim() ? text : <span className="text-[var(--muted)]">No final response yet.</span>}
      </div>
    </section>
  );
}

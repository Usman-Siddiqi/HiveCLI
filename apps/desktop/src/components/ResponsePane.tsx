interface ResponsePaneProps {
  content: string;
}

export function ResponsePane({ content }: ResponsePaneProps) {
  return (
    <div className="min-h-64 rounded-[1.5rem] border border-line bg-slate-950/60 p-4 text-sm leading-7 text-slate-200">
      <pre className="whitespace-pre-wrap font-body">{content || "No final output yet."}</pre>
    </div>
  );
}

import { useState } from "react";
import { ArrowUpRight, LoaderCircle } from "lucide-react";

interface PromptBarProps {
  onSubmit: (prompt: string) => Promise<void>;
  disabled?: boolean;
  reason?: string;
  error?: string;
  running: boolean;
}

export function PromptBar({ onSubmit, disabled, reason, error, running }: PromptBarProps) {
  const [prompt, setPrompt] = useState("");
  const canSubmit = !disabled && !running && !!prompt.trim();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    try {
      await onSubmit(prompt.trim());
      setPrompt("");
    } catch {
      // The store exposes the error to the composer. Keep the draft for retry.
    }
  }

  return (
    <form className="prompt-composer" onSubmit={handleSubmit}>
      <label className="prompt-label" htmlFor="council-prompt">Task brief</label>
      <textarea
        id="council-prompt"
        data-testid="prompt-input"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
        placeholder="Describe the change you want and how to verify it."
        rows={3}
        readOnly={running}
        aria-describedby="prompt-note"
      />
      <div className="composer-footer">
        <div id="prompt-note" className="composer-note" data-testid="prompt-note" role={error ? "alert" : undefined}>
          {error ? <span className="form-error">{error}</span> : reason ?? <>Run with <kbd>Ctrl</kbd> or <kbd>⌘</kbd> + <kbd>Enter</kbd></>}
        </div>
        <button data-testid="prompt-send" type="submit" className="control-button" disabled={!canSubmit}>
          {running ? <LoaderCircle size={16} className="spin" aria-hidden="true" /> : <ArrowUpRight size={17} aria-hidden="true" />}
          {running ? "Running…" : "Run council"}
        </button>
      </div>
    </form>
  );
}

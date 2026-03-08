import { useState } from "react";
import { Send } from "lucide-react";

interface PromptBarProps {
    onSubmit: (prompt: string) => Promise<void>;
    disabled?: boolean;
    reason?: string;
}

export function PromptBar({ onSubmit, disabled, reason }: PromptBarProps) {
    const [prompt, setPrompt] = useState("");
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit() {
        const text = prompt.trim();
        if (!text) return;

        setSubmitting(true);
        try {
            await onSubmit(text);
            setPrompt("");
        } finally {
            setSubmitting(false);
        }
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void handleSubmit();
        }
    }

    const isDisabled = disabled || submitting || !prompt.trim();

    return (
        <div className="hive-bar-shell">
            <div className="hive-bar">
                <textarea
                    data-testid="prompt-input"
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe your task — HiveCLI will seed worker folders, compare outputs, and publish the final result…"
                    rows={1}
                    className="hive-bar-input"
                    disabled={submitting}
                />
                <button
                    data-testid="prompt-send"
                    onClick={() => void handleSubmit()}
                    disabled={isDisabled}
                    className="hive-bar-send"
                >
                    <Send className="h-4 w-4" />
                    {submitting ? "Running…" : "Send"}
                </button>
            </div>
            <div className="hive-bar-note" data-testid="prompt-note">
                {reason ?? "Workers get isolated folders; the original project directory stays read-only for this run."}
            </div>
        </div>
    );
}

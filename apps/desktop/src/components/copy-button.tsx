import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copiedValue, setCopiedValue] = useState<string>();
  const [failed, setFailed] = useState(false);
  const copied = copiedValue === value;
  const name = copied ? `${label} copied` : `Copy ${label}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  return (
    <span className="copy-control">
      <button type="button" className="icon-button" aria-label={name} title={name} onClick={() => void copy()}>
        {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
      </button>
      <span className="sr-only" role="status">{failed ? "Clipboard unavailable." : copied ? name : ""}</span>
    </span>
  );
}

import { useEffect, useState } from "react";

import type { AppSettings } from "@hive/shared";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const settingKeys = ["openaiApiKey", "anthropicApiKey", "geminiApiKey", "defaultWorkspaceRoot"];

  useEffect(() => {
    void api.listSettings().then((value) => {
      setSettings(value);
      setDraft(Object.fromEntries(value.map((item) => [item.key, item.value])));
    });
  }, []);

  async function handleSave() {
    const pairs = Object.entries(draft).filter(([_, value]) => value !== undefined);
    await Promise.all(pairs.map(([key, value]) => api.setSetting(key, value)));
    setSettings(await api.listSettings());
  }

  return (
    <div className="surface rounded-xl p-6">
      <div className="max-w-3xl">
        <h2 className="text-[30px] font-semibold tracking-[-0.03em]">
          Local provider and workspace defaults
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          Secrets are stored locally and never streamed into the event log. CLI agents can also
          receive environment variables directly from their config.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {settingKeys.map((key) => (
            <label key={key} className="text-sm">
              <div className="mb-2 text-[var(--muted)]">{key}</div>
              <Input
                value={draft[key] ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [key]: event.target.value }))
                }
              />
            </label>
          ))}
        </div>

        <div className="mt-6">
          <Button onClick={handleSave}>Save settings</Button>
        </div>

        <div className="mt-10 rounded-lg border border-[var(--border)] bg-[var(--surface-strong)] p-4">
          <div className="text-sm font-medium">Stored keys</div>
          <div className="mt-3 text-sm text-[var(--muted)]">
            {settings.length > 0
              ? settings.map((setting) => setting.key).join(", ")
              : "No settings stored yet."}
          </div>
        </div>
      </div>
    </div>
  );
}

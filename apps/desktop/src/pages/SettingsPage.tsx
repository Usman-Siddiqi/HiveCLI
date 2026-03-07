import { useAppStore } from "@/stores/app-store";

export function SettingsPage() {
  const settings = useAppStore((state) => state.settings);

  return (
    <section className="control-panel p-8">
      <p className="signal-label">App Settings</p>
      <h2 className="font-display text-4xl font-semibold text-white">Local Control Surface</h2>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-[1.5rem] border border-line bg-slate-950/35 p-5">
          <p className="signal-label">Orchestrator URL</p>
          <p className="mt-3 text-base text-slate-100">{settings?.orchestratorUrl ?? "Unavailable"}</p>
        </div>
        <div className="rounded-[1.5rem] border border-line bg-slate-950/35 p-5">
          <p className="signal-label">Storage Path</p>
          <p className="mt-3 text-base text-slate-100">{settings?.storagePath ?? "Unavailable"}</p>
        </div>
        <div className="rounded-[1.5rem] border border-line bg-slate-950/35 p-5">
          <p className="signal-label">Theme</p>
          <p className="mt-3 text-base text-slate-100">{settings?.theme ?? "dark"}</p>
        </div>
      </div>
    </section>
  );
}

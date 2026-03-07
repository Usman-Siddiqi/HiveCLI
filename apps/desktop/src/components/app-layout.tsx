import { Settings2 } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useAppBootstrap } from "@/hooks/use-app-bootstrap";
import { useAppStore } from "@/stores/app-store";

export function AppLayout() {
  useAppBootstrap();
  const connectionState = useAppStore((state) => state.connectionState);

  return (
    <div className="app-shell">
      <div className="app-topbar">
        <div className="app-topbar-brand">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          HiveCLI
        </div>
        <div className="app-topbar-status">
          <span
            className={`inline-block h-2 w-2 rounded-full ${connectionState === "open"
                ? "bg-emerald-500"
                : connectionState === "connecting"
                  ? "bg-amber-400 animate-pulse"
                  : "bg-zinc-600"
              }`}
          />
          <span className="capitalize">{connectionState}</span>
          <NavLink to="/settings" className="ml-4 text-[var(--muted)] transition hover:text-[var(--text)]">
            <Settings2 className="h-4 w-4" />
          </NavLink>
        </div>
      </div>
      <Outlet />
    </div>
  );
}

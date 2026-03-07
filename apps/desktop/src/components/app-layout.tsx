import { History, LayoutDashboard, Settings2, Sparkles } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

import { useAppBootstrap } from "@/hooks/use-app-bootstrap";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/swarm", label: "Swarm", icon: Sparkles },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings2 },
];

export function AppLayout() {
  useAppBootstrap();

  return (
    <div className="app-shell">
      <div className="app-frame">
        <aside className="app-sidebar">
          <div className="app-sidebar-content">
            <div className="border-b border-[var(--border)] pb-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
                HiveCLI
              </div>
              <h1 className="mt-3 text-[30px] font-semibold leading-none">Swarm Desk</h1>
              <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                Local operator workspace for parallel CLI and LLM runs.
              </p>
            </div>

            <nav className="mt-5 space-y-1.5">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn("shell-link", isActive && "shell-link-active")
                  }
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>

            <div className="mt-auto border-t border-[var(--border)] pt-4 text-xs leading-5 text-[var(--muted)]">
              Panels stay terminal-first, sessions are persisted locally, and shell access remains visible.
            </div>
          </div>
        </aside>

        <main className="app-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

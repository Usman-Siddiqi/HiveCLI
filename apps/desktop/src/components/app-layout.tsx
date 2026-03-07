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
    <div className="grid-background min-h-screen px-5 py-5">
      <div className="mx-auto grid min-h-[calc(100vh-40px)] max-w-[1680px] grid-cols-[220px_1fr] gap-5">
        <aside className="panel rounded-[30px] p-4">
          <div className="mb-8">
            <div className="text-xs uppercase tracking-[0.3em] text-[var(--accent)]">
              HiveCLI
            </div>
            <h1 className="mt-2 text-3xl font-semibold leading-none">Swarm Desk</h1>
            <p className="mt-3 text-sm text-[var(--muted)]">
              Multi-agent control room for terminal-backed developer workflows.
            </p>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition",
                    isActive
                      ? "border-[var(--border-strong)] bg-[var(--accent)]/10 text-[var(--text)]"
                      : "border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:bg-white/5 hover:text-[var(--text)]",
                  )
                }
              >
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-h-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

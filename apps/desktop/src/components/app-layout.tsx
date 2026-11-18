import { ChevronRight, GitFork, History, Hexagon, SlidersHorizontal } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { WorkspaceDirectoryControl } from "@/components/workspace-directory-control";
import { useAppBootstrap } from "@/hooks/use-app-bootstrap";
import { useAppStore } from "@/stores/app-store";

const navigation = [
  { to: "/", label: "Council", icon: GitFork },
  { to: "/history", label: "Run history", icon: History },
  { to: "/settings", label: "Agents", icon: SlidersHorizontal },
];

export function AppLayout() {
  useAppBootstrap();
  const { pathname } = useLocation();
  const connectionState = useAppStore((state) => state.connectionState);
  const workspaceDetail = useAppStore((state) => state.workspaceDetail);
  const workspaceRootStatus = useAppStore((state) => state.workspaceRootStatus);
  const updateWorkspaceRoot = useAppStore((state) => state.updateWorkspaceRoot);
  const bootError = useAppStore((state) => state.bootError);
  const boot = useAppStore((state) => state.boot);
  const runningTask = useAppStore((state) => state.runningTask);
  const page = navigation.find(({ to }) => pathname === to)?.label ?? "Council";
  const connectionLabel = {
    idle: "Starting",
    connecting: "Connecting",
    open: "Connected",
    closed: "Disconnected",
  }[connectionState];

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Workspace sidebar">
        <NavLink to="/" end className="brand">
          <span className="brand-mark">
            <Hexagon size={21} strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span>HiveCLI</span>
        </NavLink>

        <WorkspaceDirectoryControl
          workspaceName={workspaceDetail?.workspace.name}
          rootStatus={workspaceRootStatus}
          onUpdateRoot={updateWorkspaceRoot}
          disabled={!workspaceDetail || runningTask}
        />

        <nav className="app-nav" aria-label="Workspace">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end className="nav-item">
              <Icon size={17} strokeWidth={1.8} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="app-crumb">
            <span>{workspaceDetail?.workspace.name ?? "Workspace"}</span>
            <ChevronRight size={14} aria-hidden="true" />
            <strong>{page}</strong>
          </div>
          <span className="connection-state" data-state={connectionState} role="status">
            <span aria-hidden="true" />
            {connectionLabel}
          </span>
        </header>
        {bootError ? (
          <main className="page-frame">
            <h1 className="page-title">Workspace unavailable</h1>
            <p className="page-description" role="alert">{bootError}</p>
            <button type="button" className="control-button mt-5" onClick={() => void boot()}>
              Retry connection
            </button>
          </main>
        ) : (
          <main className="page-frame" id="main-content">
            <Outlet />
          </main>
        )}
      </div>
    </div>
  );
}

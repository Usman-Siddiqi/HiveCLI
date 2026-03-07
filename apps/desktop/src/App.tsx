import { useEffect } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { WorkspaceSidebar } from "@/components/WorkspaceSidebar";
import { useAppStore } from "@/stores/app-store";

import { SessionHistoryPage } from "./pages/SessionHistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SwarmPage } from "./pages/SwarmPage";
import { WorkspaceDashboardPage } from "./pages/WorkspaceDashboardPage";

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const { init, loading, error, workspaces, activeWorkspace, selectWorkspace } = useAppStore((state) => ({
    init: state.init,
    loading: state.loading,
    error: state.error,
    workspaces: state.workspaces,
    activeWorkspace: state.activeWorkspace,
    selectWorkspace: state.selectWorkspace,
  }));

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (location.pathname === "/" && workspaces[0]) {
      navigate(`/workspaces/${workspaces[0].id}`, { replace: true });
    }
  }, [location.pathname, navigate, workspaces]);

  return (
    <div className="grid min-h-screen gap-5 p-5 xl:grid-cols-[320px_1fr]">
      <WorkspaceSidebar
        activeWorkspaceId={activeWorkspace?.workspace.id}
        onSelect={(workspaceId) => {
          void selectWorkspace(workspaceId);
          navigate(`/workspaces/${workspaceId}`);
        }}
        workspaces={workspaces}
      />

      <main className="min-w-0">
        {loading ? (
          <div className="control-panel flex min-h-[50vh] items-center justify-center p-10">
            <div>
              <p className="signal-label">Booting</p>
              <h2 className="font-display text-4xl font-semibold text-white">Synchronizing control room...</h2>
            </div>
          </div>
        ) : error ? (
          <div className="control-panel p-8">
            <p className="signal-label">Fault</p>
            <h2 className="font-display text-4xl font-semibold text-white">Orchestrator unreachable</h2>
            <p className="mt-4 text-base text-slate-300">{error}</p>
          </div>
        ) : (
          <Routes>
            <Route element={<WorkspaceDashboardPage />} path="/" />
            <Route element={<SwarmPage />} path="/workspaces/:workspaceId" />
            <Route element={<SessionHistoryPage />} path="/workspaces/:workspaceId/history" />
            <Route element={<SettingsPage />} path="/settings" />
          </Routes>
        )}
      </main>
    </div>
  );
}

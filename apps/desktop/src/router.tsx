import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "@/components/app-layout";
import { SwarmPage } from "@/pages/swarm-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <SwarmPage /> },
      {
        path: "history",
        lazy: async () => ({ Component: (await import("@/pages/history-page")).HistoryPage }),
      },
      {
        path: "settings",
        lazy: async () => ({ Component: (await import("@/pages/settings-page")).SettingsPage }),
      },
    ],
  },
]);

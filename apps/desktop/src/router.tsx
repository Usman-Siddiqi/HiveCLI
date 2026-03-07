import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "@/components/app-layout";
import { SettingsPage } from "@/pages/settings-page";
import { SwarmPage } from "@/pages/swarm-page";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <SwarmPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
]);

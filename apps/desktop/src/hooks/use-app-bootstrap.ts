import { useEffect } from "react";

import { useAppStore } from "@/stores/app-store";

export function useAppBootstrap() {
  const boot = useAppStore((state) => state.boot);

  useEffect(() => {
    void boot();
  }, [boot]);
}

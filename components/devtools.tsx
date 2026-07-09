"use client";

import { EveDevtoolsProvider } from "eve-devtools/react";
import { type ReactNode, useEffect, useState } from "react";

// The eve trace panel: always on in development, and in production after
// opting in with Ctrl+D (persisted) or `localStorage.devtools = "1"`.
export function Devtools({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const optedIn = localStorage.getItem("devtools") === "1";
    setEnabled(process.env.NODE_ENV === "development" || optedIn);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "d" || !event.ctrlKey || event.metaKey || event.altKey)
        return;
      event.preventDefault();
      setEnabled((prev) => {
        const next = !prev;
        localStorage.setItem("devtools", next ? "1" : "0");
        return next;
      });
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <EveDevtoolsProvider enabled={enabled}>{children}</EveDevtoolsProvider>
  );
}

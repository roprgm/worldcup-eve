"use client";

import { EveDevtoolsProvider } from "eve-devtools/react";
import { type ReactNode, useEffect, useState } from "react";

// The eve trace panel: always on in development, and in production after
// opting in from the browser console with `localStorage.devtools = "1"`.
export function Devtools({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const optedIn = localStorage.getItem("devtools") === "1";
    setEnabled(process.env.NODE_ENV === "development" || optedIn);
  }, []);

  return (
    <EveDevtoolsProvider enabled={enabled}>{children}</EveDevtoolsProvider>
  );
}

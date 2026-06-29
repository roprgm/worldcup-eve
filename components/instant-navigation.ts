"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAVIGATION_EVENT = "wc26:navigate";

export function pushInstantPath(path: string) {
  if (window.location.pathname !== path) {
    window.history.pushState(null, "", path);
  }
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

export function useInstantPathname() {
  const pathname = usePathname();
  const [instantPathname, setInstantPathname] = useState(pathname);

  useEffect(() => {
    setInstantPathname(pathname);
  }, [pathname]);

  useEffect(() => {
    const sync = () => setInstantPathname(window.location.pathname);
    window.addEventListener(NAVIGATION_EVENT, sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener(NAVIGATION_EVENT, sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  return instantPathname;
}

"use client";

import { useSyncExternalStore } from "react";

// One shared load+decode for the whole app: every Flag subscribes to the same
// status so they fade in together the instant the sprite is ready.
let loaded = false;
const listeners = new Set<() => void>();

function ensureLoading(src: string) {
  if (loaded || typeof window === "undefined") return;
  const img = new Image();
  img.src = src;
  const done = () => {
    loaded = true;
    for (const notify of listeners) notify();
  };
  if (img.complete) done();
  else img.addEventListener("load", done, { once: true });
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useSpriteLoaded(src: string) {
  ensureLoading(src);
  return useSyncExternalStore(
    subscribe,
    () => loaded,
    () => false,
  );
}

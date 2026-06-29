import { useEffect, useMemo, useRef } from "react";

type RafCallback = (time: number) => void;

/** Drives `callback` once per animation frame while the loop is active. Mirrors
 *  react-use's `useRafLoop`: returns `[stop, start, isActive]`, always invokes
 *  the latest `callback` without restarting the loop, and cancels any pending
 *  frame on unmount. Pass `initiallyActive: false` to start the loop on demand.
 *
 *  Keeps `requestAnimationFrame` out of components — they just `start()`/`stop()`. */
export function useRafLoop(
  callback: RafCallback,
  initiallyActive = true,
): [stop: () => void, start: () => void, isActive: () => boolean] {
  const raf = useRef(0);
  const active = useRef(false);
  const cb = useRef(callback);
  cb.current = callback;

  const controls = useMemo(() => {
    const step = (time: number) => {
      if (!active.current) return;
      cb.current(time);
      raf.current = requestAnimationFrame(step);
    };
    const stop = () => {
      if (!active.current) return;
      active.current = false;
      cancelAnimationFrame(raf.current);
    };
    const start = () => {
      if (active.current) return;
      active.current = true;
      raf.current = requestAnimationFrame(step);
    };
    const isActive = () => active.current;
    return [stop, start, isActive] as [() => void, () => void, () => boolean];
  }, []);

  useEffect(() => {
    if (initiallyActive) controls[1]();
    return controls[0];
  }, [controls, initiallyActive]);

  return controls;
}

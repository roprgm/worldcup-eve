import {
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useMemo,
  useRef,
} from "react";

import { useRafLoop } from "@/hooks/use-raf-loop";

/** A node registered with a proximity field: its element plus the position used
 *  to measure distance to the cursor, in the consumer's own coordinate space
 *  (whatever `onFrame` compares the cursor against), and any extra `meta`. */
export interface ProximityNode<M = unknown> {
  x: number;
  y: number;
  meta: M;
  el: HTMLElement;
}

export interface ProximityField<M = unknown> {
  register: (id: string, node: ProximityNode<M>) => void;
  unregister: (id: string) => void;
}

/** Cursor position relative to the container's top-left, in CSS pixels. */
export interface Cursor {
  x: number;
  y: number;
}

/** Generic "cursor magnetism" field: tracks the pointer over a container and,
 *  every animation frame while it's inside, calls `onFrame` for each registered
 *  node so the consumer can drive an effect from the node's distance to the
 *  cursor. The loop runs only while hovering; on leave `onFrame` fires once per
 *  node with a null cursor so the effect can reset, then it idles. No React
 *  renders per move — `onFrame` mutates the node's element directly.
 *
 *  The field is coordinate-agnostic: `cursor` is reported in container pixels and
 *  node positions are whatever the consumer registered, so `onFrame` owns the
 *  mapping and the distance→effect curve. */
export function useProximityField<
  M = unknown,
  E extends HTMLElement = HTMLDivElement,
>(
  onFrame: (
    node: ProximityNode<M>,
    cursor: Cursor | null,
    rect: DOMRect,
  ) => void,
): {
  containerRef: RefObject<E | null>;
  field: ProximityField<M>;
  onPointerMove: (e: ReactPointerEvent<E>) => void;
  onPointerLeave: () => void;
} {
  const containerRef = useRef<E>(null);
  const nodes = useRef(new Map<string, ProximityNode<M>>());
  const cursor = useRef<Cursor | null>(null);
  const cb = useRef(onFrame);
  cb.current = onFrame;

  const field = useMemo<ProximityField<M>>(
    () => ({
      register: (id, node) => nodes.current.set(id, node),
      unregister: (id) => nodes.current.delete(id),
    }),
    [],
  );

  const [stop, start] = useRafLoop(() => {
    const container = containerRef.current;
    const c = cursor.current;
    if (!container || !c) return;
    const rect = container.getBoundingClientRect();
    for (const node of nodes.current.values()) cb.current(node, c, rect);
  }, false);

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<E>) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      cursor.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      start();
    },
    [start],
  );

  // Idle the loop and let each node reset to its resting state (onFrame with a
  // null cursor).
  const onPointerLeave = useCallback(() => {
    const container = containerRef.current;
    cursor.current = null;
    stop();
    if (!container) return;
    const rect = container.getBoundingClientRect();
    for (const node of nodes.current.values()) cb.current(node, null, rect);
  }, [stop]);

  return { containerRef, field, onPointerMove, onPointerLeave };
}

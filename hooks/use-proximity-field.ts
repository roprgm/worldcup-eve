import { type PointerEvent, useMemo, useRef } from "react";

/** Cursor position relative to the container's top-left, in CSS pixels. */
export type Cursor = { x: number; y: number } | null;

export interface ProximityField<Node> {
  register: (id: string, node: Node) => void;
  unregister: (id: string) => void;
}

/** Generic cursor-proximity effect: on every pointer move, hands each
 *  registered node to `onUpdate` with the cursor (null once the pointer
 *  leaves). The consumer owns the distance → effect mapping and mutates its
 *  element directly, so nothing re-renders per move. */
export function useProximityField<Node extends { el: HTMLElement }>(
  onUpdate: (node: Node, cursor: Cursor, rect: DOMRect) => void,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, Node>());

  const field = useMemo<ProximityField<Node>>(
    () => ({
      register: (id, node) => nodes.current.set(id, node),
      unregister: (id) => nodes.current.delete(id),
    }),
    [],
  );

  const apply = (cursor: Cursor) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    for (const node of nodes.current.values()) onUpdate(node, cursor, rect);
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) apply({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const onPointerLeave = () => apply(null);

  return { containerRef, field, onPointerMove, onPointerLeave };
}

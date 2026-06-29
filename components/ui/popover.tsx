"use client";

import { cn } from "cnfast";
import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

interface Placement {
  top: number;
  left: number;
  side: "top" | "bottom";
  arrow: number; // caret offset from the panel's left edge
}

interface PopoverProps {
  /** The element the popover points at and is positioned against. */
  anchor: HTMLElement;
  onClose: () => void;
  children: ReactNode;
  /** Extra classes for the panel — typically its width and padding. */
  className?: string;
}

/** A controlled popover anchored to an element: portaled and fixed so it floats
 *  over everything without shifting layout or being clipped, with a caret that
 *  points back at the anchor. Follows the anchor on scroll/resize and closes on an
 *  outside click, Escape, or the anchor leaving the page. */
export function Popover({
  anchor,
  onClose,
  children,
  className,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Placement | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const el = ref.current;
      if (!el) return;
      if (!anchor.isConnected) return onClose();
      const a = anchor.getBoundingClientRect();
      const { offsetWidth: w, offsetHeight: h } = el;
      const margin = 8;
      const center = a.left + a.width / 2;
      const left = Math.min(
        Math.max(margin, center - w / 2),
        window.innerWidth - w - margin,
      );
      const above = a.top - h - 6;
      const flip =
        a.bottom + 6 + h > window.innerHeight - margin && above > margin;
      const top = flip ? above : a.bottom + 6;
      const arrow = Math.min(Math.max(center - left, 14), w - 14);
      setPos({ top, left, side: flip ? "bottom" : "top", arrow });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [anchor, onClose]);

  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={ref}
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos ? "visible" : "hidden",
      }}
      className={cn("fixed z-50", pos && "animate-pop-in")}
    >
      <div
        role="dialog"
        className={cn(
          "max-h-[60vh] overflow-y-auto rounded-lg border border-border-strong bg-card shadow-[0_3px_12px_-2px_rgba(0,0,0,0.45)]",
          className,
        )}
      >
        {children}
      </div>
      {pos && (
        <span
          aria-hidden
          style={{ left: pos.arrow - 4 }}
          className={cn(
            "absolute size-2 rotate-45 border-border-strong bg-card",
            pos.side === "top"
              ? "-top-1 border-t border-l"
              : "-bottom-1 border-r border-b",
          )}
        />
      )}
    </div>,
    document.body,
  );
}

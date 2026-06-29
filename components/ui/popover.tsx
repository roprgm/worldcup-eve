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
  /** Whether the popover is shown. Flipping this to false plays the exit
   *  animation, after which the popover removes itself from the DOM. */
  open: boolean;
  /** The element the popover points at and is positioned against. Required
   *  while `open`; the parent may drop it to null as it closes. */
  anchor: HTMLElement | null;
  /** Requests a close — fired on an outside click, Escape, or the anchor
   *  leaving the page. Set `open` to false in response. */
  onClose: () => void;
  children: ReactNode;
  /** Extra classes for the panel — typically its width and padding. */
  className?: string;
}

/** A controlled popover anchored to an element: portaled and fixed so it floats
 *  over everything without shifting layout or being clipped, with a caret that
 *  points back at the anchor. Follows the anchor on scroll/resize, animates both
 *  in and out, and requests a close on an outside click, Escape, or the anchor
 *  leaving the page.
 *
 *  It outlives its own `open` prop: when the parent closes it, the popover stays
 *  mounted to play the exit animation, then unmounts itself. That keeps a single
 *  close path whether the dismissal comes from within (outside click, Escape) or
 *  from the parent toggling it shut. */
export function Popover({
  open,
  anchor,
  onClose,
  children,
  className,
}: PopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Placement | null>(null);

  // Linger after `open` goes false so the exit animation can play.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const exiting = mounted && !open;

  // As the parent closes, `anchor` and `children` fall away; hold on to the last
  // ones so the popover can finish animating out exactly where it stood.
  const anchorRef = useRef(anchor);
  if (anchor) anchorRef.current = anchor;
  const childrenRef = useRef(children);
  if (open) childrenRef.current = children;
  const target = anchorRef.current;

  // Replay the entrance whenever the popover hops straight to a new anchor
  // (e.g. tapping another node) without unmounting in between.
  const [generation, setGeneration] = useState(0);
  const seenAnchor = useRef(anchor);
  if (open && anchor && anchor !== seenAnchor.current) {
    seenAnchor.current = anchor;
    setGeneration((g) => g + 1);
  }

  useLayoutEffect(() => {
    if (!open || !target) return;
    const place = () => {
      const el = ref.current;
      if (!el) return;
      if (!target.isConnected) return onClose();
      const a = target.getBoundingClientRect();
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
  }, [open, target, onClose]);

  useEffect(() => {
    if (!open || !target) return;
    const onPointer = (e: PointerEvent) => {
      const node = e.target as Node;
      if (!ref.current?.contains(node) && !target.contains(node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, target, onClose]);

  if (!mounted || !target) return null;

  return createPortal(
    <div
      key={generation}
      ref={ref}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && exiting) setMounted(false);
      }}
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        visibility: pos ? "visible" : "hidden",
      }}
      className={cn(
        "fixed z-50",
        pos && (exiting ? "animate-pop-out" : "animate-pop-in"),
      )}
    >
      <div
        role="dialog"
        className={cn(
          "max-h-[60vh] overflow-y-auto rounded-lg border border-border-strong bg-card shadow-[0_3px_12px_-2px_rgba(0,0,0,0.45)]",
          className,
        )}
      >
        {childrenRef.current}
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

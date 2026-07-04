"use client";

import { cn } from "cnfast";
import { X } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

/** A centered modal over a dimmed, click-to-close backdrop. Generic — it knows
 *  nothing about what it wraps. Closes on Escape or backdrop click. */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="animate-fade-in absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "animate-pop-in relative z-10 w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

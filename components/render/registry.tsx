"use client";

import { defineRegistry } from "@json-render/react";
import { cn } from "cnfast";
import { catalog } from "@/components/render/catalog";

// Maps each catalog component to a React implementation, styled with the app's
// existing Geist design tokens so widgets match the chat surface.
const { registry } = defineRegistry(catalog, {
  components: {
    MatchList: ({ children }) => (
      <div className="wc-animate-in mt-3 flex flex-col gap-2.5">{children}</div>
    ),

    MatchCard: ({ props, children }) => (
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-3.5 py-2">
          <StatusPill status={props.status} label={props.statusLabel} />
        </div>
        <div className="divide-y divide-border">{children}</div>
      </div>
    ),

    TeamRow: ({ props }) => (
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {props.abbreviation ? (
            <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-subtle-foreground">
              {props.abbreviation}
            </span>
          ) : null}
          <span
            className={cn(
              "truncate text-sm",
              props.winner
                ? "font-semibold text-foreground"
                : "text-muted-foreground",
            )}
          >
            {props.name}
          </span>
        </div>
        <span
          className={cn(
            "shrink-0 text-sm tabular-nums",
            props.winner
              ? "font-semibold text-foreground"
              : "text-muted-foreground",
          )}
        >
          {props.score ?? "–"}
        </span>
      </div>
    ),
  },
});

export { registry };

function StatusPill({
  status,
  label,
}: {
  status: "scheduled" | "live" | "final";
  label: string;
}) {
  if (status === "live") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400">
        <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
        {label}
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-subtle-foreground">{label}</span>
  );
}

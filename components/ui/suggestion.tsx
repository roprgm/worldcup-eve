import { cn } from "cnfast";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

export function Suggestions({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>{children}</div>
  );
}

export function Suggestion({
  suggestion,
  onSelect,
  className,
}: {
  suggestion: string;
  onSelect: (suggestion: string) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(suggestion)}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/50 py-2 pr-2.5 pl-3.5 text-left text-[0.8125rem] text-muted-foreground transition-all duration-150 hover:border-border-strong hover:bg-surface hover:text-foreground active:scale-[0.98]",
        className,
      )}
    >
      <span>{suggestion}</span>
      <ArrowUpRight className="size-3.5 text-subtle-foreground transition-colors group-hover:text-foreground" />
    </button>
  );
}

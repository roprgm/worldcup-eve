import { ChevronRight, PenLine } from "lucide-react";
import Link from "next/link";

/** The call-to-action that invites a human into the arena: build your own
 *  bracket and share it. Sits at the top of the leaderboard. */
export function CreateBracketCard() {
  return (
    <Link
      href="/arena/new"
      className="group flex items-center gap-3 rounded-lg border border-dashed border-border-strong bg-card px-3 py-3 transition-colors hover:border-foreground/40 hover:bg-surface-2 sm:gap-4 sm:px-4"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-surface-border bg-surface text-foreground">
        <PenLine className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-foreground">
          Create your own bracket
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          Make your picks and see how you stack up against the models.
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
    </Link>
  );
}

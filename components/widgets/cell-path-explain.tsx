import { Flag } from "@/components/flags";
import type { CellPath, PathOpponent } from "@/lib/predictions/team-path";
import type { Round } from "@/lib/tournament";

const ROUND_LABEL: Record<Round, string> = {
  R32: "Round of 32",
  R16: "Round of 16",
  QF: "Quarter-finals",
  SF: "Semi-finals",
  TP: "Third place",
  FINAL: "Final",
};

const roundPct = (p: number) => `${Math.round(p * 100)}%`;

/** Shared header for every prediction popover — a bold title over a muted
 *  subtitle — so the confirmed and unconfirmed popups read as one family. */
export function PopupHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-1.5">
      <p className="text-[12px] font-medium tracking-wide text-foreground/80">
        {title}
      </p>
      {subtitle && (
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

// Opponents in one match; a single locked-in one drops its "100%".
function OpponentList({ opponents }: { opponents: PathOpponent[] }) {
  const shown = opponents.filter((o) => o.probability >= 0.05);
  if (!shown.length)
    return <span className="text-muted-foreground/60">to be decided</span>;
  const locked = shown.length === 1 && shown[0].probability >= 0.99;
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {shown.map((o) => (
        <span key={o.code} className="flex items-center gap-1">
          <Flag code={o.code} size={12} />
          <span className="font-medium">{o.code}</span>
          {!locked && (
            <span className="text-muted-foreground tabular-nums">
              {roundPct(o.probability)}
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

/** The matches a team must win to reach a round, with the likely opponent and the
 *  running reach at each leg. Shared by the stage-odds table and the bracket. */
export function CellPathExplain({ path }: { path: CellPath }) {
  const note = path.dependsOnGroup ? " · depends on group finish" : "";
  return (
    <div>
      <PopupHeader
        title={`${path.name}${note}`}
        subtitle={`Road to the ${ROUND_LABEL[path.targetRound]}`}
      />
      <div className="flex flex-col gap-1.5 text-[11px]">
        {path.legs.map((leg) => (
          <div
            key={leg.round}
            className="grid grid-cols-[4.5rem_1fr_auto] items-start gap-2"
          >
            <span className="pt-px text-muted-foreground/80">
              {ROUND_LABEL[leg.round]}
            </span>
            <OpponentList opponents={leg.opponents} />
            <span className="pt-px text-foreground tabular-nums">
              {roundPct(leg.reachNext)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

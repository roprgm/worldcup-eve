import { cn } from "cnfast";

import { Flag } from "@/components/flags";
import type {
  CellPath,
  PathLeg,
  PathOpponent,
} from "@/lib/predictions/team-path";
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
      <p className="text-xs font-medium tracking-wide text-foreground/80">
        {title}
      </p>
      {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
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

/** The chain of matches a team must win to reach a round — the likely opponent
 *  and running reach at each leg. */
function PathLegs({ legs }: { legs: PathLeg[] }) {
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {legs.map((leg) => (
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
      <PathLegs legs={path.legs} />
    </div>
  );
}

export type JourneyResult = "W" | "D" | "L";

/** One match a team has already played, oriented to its own side. */
export interface JourneyLeg {
  match: number; // FIFA match number, for a stable key and ordering
  roundLabel: string; // "Group" / "Round of 16" / …
  opponent: string; // FIFA code
  score: string; // team-oriented, e.g. "2–1"
  result: JourneyResult | null; // null while the match is live
  live: boolean;
}

/** A team's actual World Cup run so far — the counterpart to the projected
 *  `CellPath`, built from real results rather than the market. */
export interface TeamJourney {
  code: string;
  name: string;
  outcomeLabel: string; // "World Cup winners" / "Eliminated in the round of 16" / …
  legs: JourneyLeg[]; // group stage → final, in match order
}

const RESULT_STYLE: Record<JourneyResult, string> = {
  W: "bg-pick/15 text-pick",
  D: "bg-muted text-muted-foreground",
  L: "bg-red-500/15 text-red-400",
};

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="mb-1 text-[10px] font-medium tracking-wide text-muted-foreground/60 uppercase">
      {children}
    </p>
  );
}

function JourneyRow({ leg }: { leg: JourneyLeg }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2">
      <span className="text-muted-foreground/80">{leg.roundLabel}</span>
      <span className="flex items-center gap-1.5">
        <span className="text-muted-foreground/60">vs</span>
        <Flag code={leg.opponent} size={12} />
        <span className="font-medium">{leg.opponent}</span>
      </span>
      <span className="flex items-center justify-end gap-1.5">
        <span className="text-foreground tabular-nums">{leg.score}</span>
        {leg.result ? (
          <span
            className={cn(
              "rounded px-1 text-[10px] font-semibold",
              RESULT_STYLE[leg.result],
            )}
          >
            {leg.result}
          </span>
        ) : leg.live ? (
          <span className="rounded bg-pick/15 px-1 text-[10px] font-semibold text-pick">
            LIVE
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** A team's bracket popover: its real run since the group stage, plus — when it's
 *  still alive — the projected road to the final. Shown for winners and losers
 *  alike, so every locked-in flag is tappable. */
export function TeamPopup({
  journey,
  path,
}: {
  journey?: TeamJourney;
  path?: CellPath;
}) {
  const title = journey?.name ?? path?.name ?? "";
  const subtitle =
    journey?.outcomeLabel ??
    (path ? `Road to the ${ROUND_LABEL[path.targetRound]}` : undefined);
  return (
    <div>
      <PopupHeader title={title} subtitle={subtitle} />
      {journey && journey.legs.length > 0 && (
        <>
          <SectionLabel>Tournament so far</SectionLabel>
          <div className="flex flex-col gap-1.5 text-xs">
            {journey.legs.map((leg) => (
              <JourneyRow key={leg.match} leg={leg} />
            ))}
          </div>
        </>
      )}
      {path && (
        <div
          className={cn(journey && "mt-3 border-t border-surface-divider pt-2")}
        >
          {journey && (
            <SectionLabel>
              {path.dependsOnGroup
                ? "Road to the final · depends on group finish"
                : "Road to the final"}
            </SectionLabel>
          )}
          <PathLegs legs={path.legs} />
        </div>
      )}
    </div>
  );
}

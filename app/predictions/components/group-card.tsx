import { Check, X } from "lucide-react";

import { Flag } from "@/app/predictions/components/flags";

import { cn } from "cnfast";

type ResultStatus = "predicted" | "final" | "live";
type Marker = "advance" | "third" | "none";

const SUMMARY_COLUMN_WIDTH = "1.5rem";

function groupGridColumns(count: number): string {
  return `auto repeat(${count}, minmax(0, 1fr)) repeat(3, ${SUMMARY_COLUMN_WIDTH})`;
}

interface TeamSummary {
  code: string;
  name?: string;
  confirmed?: boolean;
}

interface GroupCardResult {
  text: string;
  title?: string;
  status: ResultStatus;
}

interface GroupCardRow {
  position: number;
  team: TeamSummary;
  dimmed?: boolean;
  goalDiff: string;
  points: number;
  marker?: Marker;
  cells: Array<GroupCardResult | null | undefined>;
}

interface GroupCardProps {
  title: string;
  columns: string[];
  rows: GroupCardRow[];
}

function LiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0 rounded-full bg-rose-400 animate-pulse",
        className,
      )}
    />
  );
}

function LiveBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[10px] font-semibold tracking-wide text-rose-400 uppercase">
      <LiveDot className="size-1.5" />
      Live
    </span>
  );
}

function ResultCell({ result }: { result: GroupCardResult }) {
  const live = result.status === "live";

  return (
    <div
      className={cn(
        "w-full rounded py-1.5 text-center text-[11px] leading-none tabular-nums select-none",
        live
          ? "font-semibold text-rose-400"
          : result.status === "final"
            ? "font-semibold text-pick"
            : "font-semibold text-foreground/85",
      )}
      title={result.title}
    >
      <span className="relative inline-block rounded px-0.5">
        {live && (
          <span
            aria-hidden
            className="absolute -inset-x-1 -inset-y-0.5 rounded bg-rose-500/10 animate-pulse"
          />
        )}
        <span className="relative">{result.text}</span>
        {live && (
          <LiveDot className="absolute left-full top-1/2 ml-1.5 size-1.5 -translate-y-1/2" />
        )}
      </span>
    </div>
  );
}

function MarkerIcon({ marker }: { marker?: Marker }) {
  if (marker === "advance") {
    return <Check className="size-3 text-pick" strokeWidth={3} />;
  }

  if (marker === "third") {
    return (
      <span className="inline-flex size-3 items-center justify-center text-[13px] font-semibold leading-none text-muted-foreground/60">
        ?
      </span>
    );
  }

  return <X className="size-3 text-muted-foreground/45" />;
}

export function GroupCard({ title, columns, rows }: GroupCardProps) {
  const live = rows.some((row) =>
    row.cells.some((cell) => cell?.status === "live"),
  );

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-surface-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-surface-divider px-3 py-1.5 text-[11px] font-medium text-muted-foreground tabular-nums tracking-wide">
        <h3 className="truncate text-left text-foreground/70">{title}</h3>
        {live && <LiveBadge />}
      </div>

      <div
        className="grid items-center gap-x-1 gap-y-1 px-1.5 py-2"
        style={{
          gridTemplateColumns: groupGridColumns(columns.length),
        }}
      >
        <span />
        {columns.map((code) => (
          <span
            key={`head-${code}`}
            className="text-center text-[11px] leading-4 font-medium tracking-wide text-muted-foreground/75 uppercase"
          >
            {code}
          </span>
        ))}
        <span className="text-center text-[11px] leading-4 font-medium tracking-wide text-muted-foreground/75 uppercase">
          GD
        </span>
        <span className="text-center text-[11px] leading-4 font-medium tracking-wide text-muted-foreground/75 uppercase">
          Pts
        </span>
        <span />

        {rows.flatMap((row) => [
          <div
            key={`${row.team.code}:team`}
            className={cn(
              "flex items-center gap-1.5 pr-1",
              row.dimmed && "opacity-45",
            )}
          >
            <span className="w-3 text-right text-[10px] text-muted-foreground tabular-nums">
              {row.position}
            </span>
            <Flag code={row.team.code} size={16} />
            <span
              className={cn(
                "text-[12px] font-semibold tracking-wide",
                row.team.confirmed && "text-pick",
              )}
              title={row.team.name}
            >
              {row.team.code}
            </span>
          </div>,
          ...columns.map((code, index) => {
            const result = row.cells[index];
            return result ? (
              <ResultCell key={`${row.team.code}:${code}`} result={result} />
            ) : (
              <span
                key={`${row.team.code}:${code}`}
                className="flex justify-center"
              >
                <span className="size-1 rounded-full bg-border" />
              </span>
            );
          }),
          <span
            key={`${row.team.code}:gd`}
            className={cn(
              "text-center text-[11px] text-muted-foreground tabular-nums",
              row.dimmed && "opacity-60",
            )}
          >
            {row.goalDiff}
          </span>,
          <span
            key={`${row.team.code}:points`}
            className={cn(
              "text-center text-[12px] font-semibold tabular-nums",
              row.dimmed && "opacity-60",
            )}
          >
            {row.points}
          </span>,
          <span key={`${row.team.code}:marker`} className="flex justify-center">
            <MarkerIcon marker={row.marker} />
          </span>,
        ])}
      </div>
    </div>
  );
}

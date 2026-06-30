import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import {
  C,
  type FlagPos,
  GEOMETRY,
  type InnerNode,
  type SolidWhen,
} from "@/lib/bracket/geometry";
import {
  type Candidate,
  type CircularBracketView,
  circularView,
} from "@/lib/bracket/view";
import { getPredictions } from "@/lib/predictions";
import { getMatchResults } from "@/lib/results";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";
export const OG_ALT = "WC26.chat — the 2026 World Cup knockout bracket";

// FIFA buckets a matchday by US Eastern time; we use the same day as the image
// id so the og:image / twitter:image URL changes once per day and social
// crawlers fetch a fresh image instead of serving a stale cached one.
const dayKeyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Today's FIFA-day key; drives the per-day image URL. */
export function todayKey(): string {
  return dayKeyFmt.format(new Date());
}

// ── Flag sprite ─────────────────────────────────────────────────────────────
// Mirrors components/flags.tsx: a 512×288 sheet, 8 columns of 64×48 cells, in
// this fixed code order. Re-declared here (not imported) because that module is
// a client component that touches `new Image()` at load.
// biome-ignore format: keep this list as a compact grid
const FLAG_CODES = [
  "alg", "arg", "aus", "aut", "bel", "bih", "bra", "can",
  "civ", "cod", "col", "cpv", "cro", "cuw", "cze", "ecu",
  "egy", "eng", "esp", "fra", "ger", "gha", "hai", "irn",
  "irq", "jor", "jpn", "kor", "ksa", "mar", "mex", "ned",
  "nor", "nzl", "pan", "par", "por", "qat", "rsa", "sco",
  "sen", "sui", "swe", "tun", "tur", "uru", "usa", "uzb",
];
const COLS = 8;
const cellByCode = new Map(FLAG_CODES.map((code, i) => [code, i]));

// Theme colours (app CSS vars resolved to hex; satori can't read CSS vars).
const COLORS = {
  text: "#fafafa",
  muted: "#a3a3a3",
  pick: "#10b981", // --accent / --pick green: the winners' path & trophy
  grey: "rgba(255,255,255,0.15)", // --border-strong: idle connectors
  nodeBg: "#383838", // --surface-2: node base, covers lines behind it
  ring: "rgba(255,255,255,0.12)",
  live: "#fb7185",
};

// ── Geometry → pixel space ───────────────────────────────────────────────────
const BOARD = 600; // square side, in px, the 1000-unit viewBox maps onto
const NODE = 34; // flag / match node diameter
const CENTER = 44; // champion node diameter
const pctX = (x: number) => `${(x / 1000) * 100}%`;

const lead = (o?: Candidate[]) => o?.[0];
const confirmed = (o?: Candidate[]) => (lead(o)?.probability ?? 0) >= 0.99;

// A connector is solid only once a winner has actually travelled it — so the
// green lines trace the real bracket, not the still-open field.
function isSolid(view: CircularBracketView | undefined, s: SolidWhen): boolean {
  if (!view) return false;
  switch (s.kind) {
    case "never":
      return false;
    case "r32leg": {
      const win = view.decided.get(s.match);
      const team = lead(view.slotOdds.get(`${s.match}:${s.side}`));
      return !!win && !!team && win.code === team.code;
    }
    case "innerleg": {
      const win = view.decided.get(s.parent);
      const child = view.decided.get(s.child);
      return !!win && !!child && win.code === child.code;
    }
    case "finalleg": {
      const win = view.decided.get(104);
      const finalist = view.decided.get(s.sf);
      return !!win && !!finalist && win.code === finalist.code;
    }
    case "trunk":
      return !!view.decided.get(s.match);
  }
}

function Connectors({ view }: { view?: CircularBracketView }) {
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative connectors rasterised into an OG image; a <title> would render as visible text in satori.
    <svg
      viewBox="0 0 1000 1000"
      width={BOARD}
      height={BOARD}
      style={{ position: "absolute", left: 0, top: 0 }}
    >
      {GEOMETRY.arcs.map((a) => (
        <path
          key={a.d}
          d={a.d}
          fill="none"
          stroke={isSolid(view, a.solid) ? COLORS.pick : COLORS.grey}
          strokeWidth={2.5}
        />
      ))}
      {GEOMETRY.segs.map((s) => (
        <line
          key={`${s.x1},${s.y1},${s.x2},${s.y2}`}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke={isSolid(view, s.solid) ? COLORS.pick : COLORS.grey}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

// A flag cropped to a circle: the 4:3 sprite cell is scaled to the node height
// and overflow-clipped to the circle, matching the widget's RoundFlag.
function FlagCircle({
  sprite,
  code,
  size,
  ringColor,
  faded,
}: {
  sprite: string;
  code: string;
  size: number;
  ringColor: string;
  faded?: boolean;
}) {
  const i = cellByCode.get(code.toLowerCase());
  const cellW = (size * 4) / 3;
  return (
    <div
      style={{
        display: "flex",
        width: size,
        height: size,
        borderRadius: size,
        overflow: "hidden",
        background: COLORS.nodeBg,
        border: `2px solid ${ringColor}`,
      }}
    >
      {i !== undefined ? (
        <div
          style={{
            width: cellW,
            height: size,
            marginLeft: -(cellW - size) / 2,
            backgroundImage: `url(${sprite})`,
            backgroundSize: `${cellW * COLS}px ${size * 6}px`,
            backgroundPosition: `-${(i % COLS) * cellW}px -${Math.floor(i / COLS) * size}px`,
            opacity: faded ? 0.45 : 1,
          }}
        />
      ) : null}
    </div>
  );
}

function QNode({ size, live }: { size: number; live?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size,
        background: COLORS.nodeBg,
        border: `1px solid ${live ? COLORS.live : COLORS.ring}`,
        color: COLORS.muted,
        fontSize: size * 0.5,
        fontWeight: 700,
      }}
    >
      ?
    </div>
  );
}

function Trophy({ size }: { size: number }) {
  const s = Math.round(size * 0.55);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size,
        background: "#171717",
        border: `2px solid ${COLORS.pick}`,
      }}
    >
      {/* biome-ignore lint/a11y/noSvgWithoutTitle: decorative trophy glyph rasterised into an OG image. */}
      <svg
        width={s}
        height={s}
        viewBox="0 0 24 24"
        fill="none"
        stroke={COLORS.pick}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" />
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    </div>
  );
}

// One positioned node: a locked-in flag, a live leader's faded flag, or a "?".
function BracketNode({
  sprite,
  x,
  y,
  flagCode,
  liveCode,
  live,
}: {
  sprite: string;
  x: number;
  y: number;
  flagCode?: string;
  liveCode?: string;
  live: boolean;
}) {
  const content = flagCode ? (
    <FlagCircle
      sprite={sprite}
      code={flagCode}
      size={NODE}
      ringColor={COLORS.ring}
    />
  ) : live && liveCode ? (
    <FlagCircle
      sprite={sprite}
      code={liveCode}
      size={NODE}
      ringColor={COLORS.live}
      faded
    />
  ) : (
    <QNode size={NODE} live={live} />
  );
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        left: pctX(x),
        top: pctX(y),
        transform: "translate(-50%, -50%)",
      }}
    >
      {content}
    </div>
  );
}

function slotNode(pos: FlagPos, view?: CircularBracketView) {
  const odds = view?.slotOdds.get(`${pos.match}:${pos.side}`);
  return {
    x: pos.x,
    y: pos.y,
    flagCode: confirmed(odds) ? lead(odds)?.code : undefined,
    liveCode: view?.liveLeader.get(pos.match),
    live: view?.live.has(pos.match) ?? false,
  };
}

function matchNode(node: InnerNode, view?: CircularBracketView) {
  return {
    x: node.x,
    y: node.y,
    flagCode: view?.decided.get(node.match)?.code,
    liveCode: view?.liveLeader.get(node.match),
    live: view?.live.has(node.match) ?? false,
  };
}

function Bracket({
  sprite,
  view,
}: {
  sprite: string;
  view?: CircularBracketView;
}) {
  const champion = view?.decided.get(104);
  return (
    <div
      style={{
        display: "flex",
        position: "relative",
        width: BOARD,
        height: BOARD,
      }}
    >
      <Connectors view={view} />
      {GEOMETRY.nodes.map((n) => {
        const m = matchNode(n, view);
        return <BracketNode key={`m${n.match}`} sprite={sprite} {...m} />;
      })}
      {GEOMETRY.flags.map((pos) => {
        const m = slotNode(pos, view);
        return (
          <BracketNode
            key={`s${pos.match}:${pos.side}`}
            sprite={sprite}
            {...m}
          />
        );
      })}
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: pctX(C),
          top: pctX(C),
          transform: "translate(-50%, -50%)",
        }}
      >
        {champion ? (
          <FlagCircle
            sprite={sprite}
            code={champion.code}
            size={CENTER}
            ringColor={COLORS.pick}
          />
        ) : (
          <Trophy size={CENTER} />
        )}
      </div>
    </div>
  );
}

async function loadView(): Promise<CircularBracketView | undefined> {
  try {
    const [predictions, results] = await Promise.all([
      getPredictions(),
      getMatchResults().catch(() => undefined),
    ]);
    return circularView(predictions, results);
  } catch {
    return undefined;
  }
}

async function loadSprite(): Promise<string> {
  const data = await readFile(
    join(process.cwd(), "public/assets/flags-sprite.png"),
  );
  return `data:image/png;base64,${data.toString("base64")}`;
}

/** Render the current World Cup knockout bracket as the Open Graph / Twitter
 *  card — the same ring the landing shows, with teams advanced to today. */
export async function renderDailyImage(): Promise<ImageResponse> {
  const [view, sprite] = await Promise.all([loadView(), loadSprite()]);
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #0b0b0b 0%, #0d1a13 100%)",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 36,
          left: 48,
          fontSize: 30,
          fontWeight: 800,
          color: COLORS.text,
        }}
      >
        WC26<span style={{ color: COLORS.pick }}>.chat</span>
      </div>
      <Bracket sprite={sprite} view={view} />
    </div>,
    OG_SIZE,
  );
}

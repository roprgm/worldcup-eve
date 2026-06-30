// The knockout bracket as a ring: the 32 Round-of-32 slots around the outside,
// connectors merging inward to the trophy at the centre. Pure geometry computed
// once in a 1000×1000 space (the SVG viewBox). Mirrors the geometry inside the
// interactive home widget (components/widgets/circular-bracket-card.tsx); kept
// here as a server-safe module the Open Graph image renderer (lib/og) reuses so
// the shared card and the social image draw the exact same ring.

import { type KnockoutMatch, matchByNumber } from "@/lib/tournament";

export const SIZE = 1000;
export const C = SIZE / 2;

// Each half spans 180°−2·GAP, leaving a GAP wedge at top and bottom so the two
// halves read apart and the finalists meet on the horizontal centre axis.
const GAP = 0;
export const R_FLAG = 450; // outer ring: the 32 team slots
export type RoundKey = "R32" | "R16" | "QF" | "SF";

// The radial gap between each ring, working inward from the outer flags.
const RING_GAP = {
  flagToR32: 125, // outer flags (32) → round-of-16 nodes
  r32ToR16: 80, // round-of-16 nodes → round-of-8 nodes
  r16ToQF: 75, // quarter-final nodes
  qfToSF: 60, // semi-final nodes
};
// Derived ring radii (distance from centre), outside → in.
export const RING: Record<RoundKey, number> = {
  R32: R_FLAG - RING_GAP.flagToR32,
  R16: R_FLAG - RING_GAP.flagToR32 - RING_GAP.r32ToR16,
  QF: R_FLAG - RING_GAP.flagToR32 - RING_GAP.r32ToR16 - RING_GAP.r16ToQF,
  SF:
    R_FLAG -
    RING_GAP.flagToR32 -
    RING_GAP.r32ToR16 -
    RING_GAP.r16ToQF -
    RING_GAP.qfToSF,
};

const CHILD_ROUND: Record<Exclude<RoundKey, "R32">, RoundKey> = {
  R16: "R32",
  QF: "R16",
  SF: "QF",
};

const LEFT = { root: 101, start: 180 + GAP, end: 360 - GAP };
const RIGHT = { root: 102, start: GAP, end: 180 - GAP };

export type Side = "home" | "away";

// Round coordinates to a fixed precision: trig can differ in the last ULP
// between server and browser JS engines, so the raw floats would otherwise
// hydrate with a mismatched `d`/position string.
export const round2 = (n: number) => Math.round(n * 100) / 100;

/** A point on the ring of radius `r` at `deg` clockwise from the top. */
export function polar(deg: number, r: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: round2(C + r * Math.sin(rad)), y: round2(C - r * Math.cos(rad)) };
}

/** SVG arc along radius `r` from `a1` to `a2` (the bar joining a node's two
 *  children), drawn clockwise. */
function arcPath(r: number, a1: number, a2: number): string {
  const [s, e] = a1 <= a2 ? [a1, a2] : [a2, a1];
  const p1 = polar(s, r);
  const p2 = polar(e, r);
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`;
}

/** The two feeding matches of a knockout node, or `null` for a Round-of-32 leaf
 *  (whose sides come from groups, not earlier matches). */
function childMatches(m: KnockoutMatch): [number, number] | null {
  if (m.home.kind === "match" && m.away.kind === "match")
    return [m.home.match, m.away.match];
  return null;
}

/** The R32 leaf slots under a half-root, in DFS order — the order they wrap
 *  around the arc, each match's home flag then its away flag. */
function leafSlots(root: number): { match: number; side: Side }[] {
  const out: { match: number; side: Side }[] = [];
  const visit = (n: number) => {
    const kids = childMatches(matchByNumber[n]);
    if (kids) {
      visit(kids[0]);
      visit(kids[1]);
    } else {
      out.push({ match: n, side: "home" }, { match: n, side: "away" });
    }
  };
  visit(root);
  return out;
}

// When a connector is drawn solid. A leg is solid only once a team has actually
// advanced along it (the match at its outer end is played), so the solid lines
// trace the real winners' paths rather than the merely-qualified field.
export type SolidWhen =
  | { kind: "r32leg"; match: number; side: Side }
  | { kind: "innerleg"; parent: number; child: number }
  | { kind: "finalleg"; sf: number }
  | { kind: "trunk"; match: number }
  | { kind: "never" };

export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  solid: SolidWhen;
}
export interface Arc {
  d: string;
  solid: SolidWhen;
}
export interface FlagPos {
  match: number;
  side: Side;
  x: number;
  y: number;
}
export interface InnerNode {
  match: number;
  round: RoundKey;
  x: number;
  y: number;
}
export interface Geometry {
  flags: FlagPos[];
  nodes: InnerNode[];
  segs: Seg[];
  arcs: Arc[];
}

/** Angles for every node under a half-root: leaves spread evenly across the
 *  arc, each inner node centred between its two children. */
function halfAngles(root: number, start: number, end: number) {
  const leaves = leafSlots(root);
  const step = (end - start) / leaves.length;
  const flagAngle = new Map<string, number>();
  leaves.forEach((lf, i) => {
    flagAngle.set(`${lf.match}:${lf.side}`, start + (i + 0.5) * step);
  });
  const nodeAngle = new Map<number, number>();
  const visit = (n: number): number => {
    const kids = childMatches(matchByNumber[n]);
    const a = kids
      ? (visit(kids[0]) + visit(kids[1])) / 2
      : (flagAngle.get(`${n}:home`)! + flagAngle.get(`${n}:away`)!) / 2;
    nodeAngle.set(n, a);
    return a;
  };
  visit(root);
  return { leaves, flagAngle, nodeAngle };
}

/** Build the skeleton: the outer flags, the inner match nodes, and the
 *  connectors between them. Computed once at module load. */
function buildGeometry(): Geometry {
  const flags: FlagPos[] = [];
  const nodes: InnerNode[] = [];
  const segs: Seg[] = [];
  const arcs: Arc[] = [];
  const sfAngle = new Map<number, number>();

  for (const { root, start, end } of [LEFT, RIGHT]) {
    const { leaves, flagAngle, nodeAngle } = halfAngles(root, start, end);

    for (const lf of leaves) {
      const a = flagAngle.get(`${lf.match}:${lf.side}`)!;
      flags.push({ ...lf, ...polar(a, R_FLAG) });
    }

    for (const [num, ang] of nodeAngle) {
      const m = matchByNumber[num];
      const round = m.round as RoundKey;
      const rN = RING[round];
      nodes.push({ match: num, round, ...polar(ang, rN) });
      if (num === root) sfAngle.set(num, ang);

      const kids = childMatches(m);
      if (!kids) {
        // R32 → flags: the two feeding paths merge at a midpoint radius between
        // this node's ring and the flag ring — a short radial trunk runs out to
        // that midpoint, an arc there spreads to each flag's angle, and a short
        // radial spoke then enters each flag head-on (from the front).
        const rMid = (rN + R_FLAG) / 2;
        const trunk = polar(ang, rMid);
        const base = polar(ang, rN);
        segs.push({
          x1: base.x,
          y1: base.y,
          x2: trunk.x,
          y2: trunk.y,
          solid: { kind: "trunk", match: num },
        });
        for (const side of ["home", "away"] as Side[]) {
          const fa = flagAngle.get(`${num}:${side}`)!;
          const leg: SolidWhen = { kind: "r32leg", match: num, side };
          arcs.push({ d: arcPath(rMid, fa, ang), solid: leg });
          const mid = polar(fa, rMid);
          const tip = polar(fa, R_FLAG);
          segs.push({
            x1: mid.x,
            y1: mid.y,
            x2: tip.x,
            y2: tip.y,
            solid: leg,
          });
        }
      } else {
        // Inner nodes keep the original side-entry style: a spoke from each child
        // out to the parent's ring, and an arc at the parent radius that bends
        // into the node from the side.
        const rChild = RING[CHILD_ROUND[round as Exclude<RoundKey, "R32">]];
        for (const cm of kids) {
          const ca = nodeAngle.get(cm)!;
          const inner = polar(ca, rN);
          const outer = polar(ca, rChild);
          const leg: SolidWhen = { kind: "innerleg", parent: num, child: cm };
          segs.push({
            x1: inner.x,
            y1: inner.y,
            x2: outer.x,
            y2: outer.y,
            solid: leg,
          });
          arcs.push({ d: arcPath(rN, ca, ang), solid: leg });
        }
      }
    }
  }

  // The final: each semi runs straight to the centre, where the champion sits.
  for (const sf of [LEFT.root, RIGHT.root]) {
    const p = polar(sfAngle.get(sf)!, RING.SF);
    segs.push({
      x1: C,
      y1: C,
      x2: p.x,
      y2: p.y,
      solid: { kind: "finalleg", sf },
    });
  }

  return { flags, nodes, segs, arcs };
}

export const GEOMETRY = buildGeometry();

"use client";

import { cn } from "cnfast";
import spriteImage from "@/components/flags-sprite.png";
import { useSpriteLoaded } from "@/hooks/use-sprite-loaded";

// The flag order for the spritesheet. This list is the single source of truth
// for which cell each team occupies, and the lookup below maps a code to that
// same cell. It is deliberately self-contained — NOT derived from the team list
// in `@/lib/tournament` — so reordering teams there can never shift a flag onto
// the wrong cell. flags-sprite.png is a vendored asset (origin-fixture sprite
// script), imported so Next content-hashes it for long-term caching.
// biome-ignore format: keep this list as a compact grid
export const FLAG_CODES = [
  "alg", "arg", "aus", "aut", "bel", "bih", "bra", "can",
  "civ", "cod", "col", "cpv", "cro", "cuw", "cze", "ecu",
  "egy", "eng", "esp", "fra", "ger", "gha", "hai", "irn",
  "irq", "jor", "jpn", "kor", "ksa", "mar", "mex", "ned",
  "nor", "nzl", "pan", "par", "por", "qat", "rsa", "sco",
  "sen", "sui", "swe", "tun", "tur", "uru", "usa", "uzb",
] as const;

const SPRITE_URL = spriteImage.src;
// 8 columns keeps the 48-flag sheet near-square (512x288, 6 rows of 64x48).
const COLS = 8;
const ROWS = Math.ceil(FLAG_CODES.length / COLS);

const cellByCode = new Map<string, number>(
  FLAG_CODES.map((code, index) => [code, index] as [string, number]),
);

interface FlagProps {
  /** FIFA 3-letter team code, e.g. "MEX" — selects the cell in the sprite. */
  code?: string;
  /** Width: a px number, or any CSS length (e.g. a `var(--flag)`) to size the
   *  flag responsively. Height is derived at a 4:3 ratio. */
  size?: number | string;
  className?: string;
}

// Express the cell geometry in terms of the (possibly CSS-var) width so the
// sprite scales with it. A number stays exact px; a string goes through calc().
function flagMetrics(size: number | string) {
  if (typeof size === "number") {
    const height = Math.round((size * 3) / 4);
    return {
      width: `${size}px`,
      height: `${height}px`,
      bgSize: `${COLS * size}px ${ROWS * height}px`,
      pos: (col: number, row: number) => `-${col * size}px -${row * height}px`,
    };
  }
  const h = `calc(${size} * 3 / 4)`;
  return {
    width: size,
    height: h,
    bgSize: `calc(${size} * ${COLS}) calc(${h} * ${ROWS})`,
    pos: (col: number, row: number) =>
      `calc(${size} * ${-col}) calc(${h} * ${-row})`,
  };
}

/**
 * Small country flag rendered from the shared spritesheet. Instance it with a
 * team's FIFA code — no per-flag asset wiring at the call site. Flags only
 * render at <=24px, so the 64x48 cells stay crisp at retina while the whole
 * tournament costs one request. Falls back to a muted box for undetermined
 * slots or codes missing from the sheet.
 */
export function Flag({ code, size = 18, className }: FlagProps) {
  const { width, height, bgSize, pos } = flagMetrics(size);
  const loaded = useSpriteLoaded(SPRITE_URL);
  const base = "inline-block shrink-0 rounded-[2px] ring-1 ring-white/15";

  const index = code ? cellByCode.get(code.toLowerCase()) : undefined;
  if (index === undefined) {
    return (
      <span
        aria-hidden
        style={{ width, height }}
        className={cn(base, "bg-muted", className)}
      />
    );
  }

  const col = index % COLS;
  const row = Math.floor(index / COLS);
  return (
    <span
      aria-hidden
      style={{
        width,
        height,
        backgroundImage: `url(${SPRITE_URL})`,
        backgroundSize: bgSize,
        backgroundPosition: pos(col, row),
        backgroundRepeat: "no-repeat",
        opacity: loaded ? 1 : 0,
      }}
      className={cn(base, "transition-opacity duration-500", className)}
    />
  );
}

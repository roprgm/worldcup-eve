"use client";

import { cn } from "cnfast";
import { useEffect, useState } from "react";

const SPRITE_URL = "/assets/flags-sprite.png";

// biome-ignore format: keep this list as a compact grid
export const FLAG_CODES = [
  "alg", "arg", "aus", "aut", "bel", "bih", "bra", "can",
  "civ", "cod", "col", "cpv", "cro", "cuw", "cze", "ecu",
  "egy", "eng", "esp", "fra", "ger", "gha", "hai", "irn",
  "irq", "jor", "jpn", "kor", "ksa", "mar", "mex", "ned",
  "nor", "nzl", "pan", "par", "por", "qat", "rsa", "sco",
  "sen", "sui", "swe", "tun", "tur", "uru", "usa", "uzb",
] as const;

// 8 columns keeps the 48-flag sheet near-square (512x288, 6 rows of 64x48).
const COLS = 8;
const ROWS = Math.ceil(FLAG_CODES.length / COLS);

function loadSprite() {
  return new Promise<void>((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve();
    img.onerror = () => {
      reject(new Error(`Failed to load sprite: ${SPRITE_URL}`));
    };

    img.src = SPRITE_URL;

    if (img.complete && img.naturalWidth > 0) {
      resolve();
    }
  });
}

// Load the sprite once, lazily, on the first client mount — never at module
// scope, since this "use client" module is still evaluated during SSR where
// `Image` is undefined (which would reject an unhandled module-level promise).
let spritePromise: Promise<void> | undefined;

function useSpriteLoaded() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    let active = true;
    spritePromise ??= loadSprite();
    // Reveal on success, and also on failure so a missing sprite doesn't leave
    // every flag stuck invisible (and to handle the rejection).
    const reveal = () => {
      if (active) setLoaded(true);
    };
    spritePromise.then(reveal, reveal);
    return () => {
      active = false;
    };
  }, []);
  return loaded;
}

const cellByCode = new Map<string, number>(
  FLAG_CODES.map((code, index) => [code, index] as [string, number]),
);

interface FlagProps {
  code?: string;
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

export function Flag({ code, size = 18, className }: FlagProps) {
  const { width, height, bgSize, pos } = flagMetrics(size);
  const loaded = useSpriteLoaded();
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

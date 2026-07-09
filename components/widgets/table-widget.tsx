"use client";

import { cn } from "cnfast";

import { Card } from "@/components/ui/card";

// The body of a ```table block: pipe-separated rows, header first. GFM habits
// are tolerated — leading/trailing pipes and |---| divider lines just drop out.
const isDivider = (line: string) => /^[\s|:-]+$/.test(line);

const cells = (line: string) =>
  line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((c) => c.trim());

function parseTable(body: string) {
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !isDivider(l));
  if (lines.length < 2) return null;
  const [header, ...rows] = lines.map(cells);
  return { header, rows };
}

// Right-align a column when every one of its cells reads as a number-ish value
// (minutes, counts, scores), so figures line up.
const NUMERIC = /^[\d'.,:%+±-]+$/;
const numericColumns = (header: string[], rows: string[][]) =>
  header.map((_, i) => rows.every((r) => !r[i] || NUMERIC.test(r[i])));

/** Tabular query results, straight from the block body — the one widget whose
 *  data arrives inline rather than being re-fetched. */
export function TableWidget({ body }: { body: string }) {
  const table = parseTable(body);
  if (!table) return null;
  const { header, rows } = table;
  const numeric = numericColumns(header, rows);

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-surface-divider text-muted-foreground/70">
              {header.map((h, i) => (
                <th
                  key={h}
                  className={cn(
                    "px-3 py-1.5 text-left font-medium tracking-wide",
                    numeric[i] && "text-right",
                  )}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              // Rows are static output with no identity beyond their position.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              <tr
                key={ri}
                className="border-b border-surface-divider/50 last:border-0"
              >
                {header.map((h, ci) => (
                  <td
                    key={h}
                    className={cn(
                      "px-3 py-1.5 text-foreground/80",
                      numeric[ci] && "text-right tabular-nums",
                    )}
                  >
                    {row[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

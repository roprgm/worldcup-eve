"use client";

import { Check, Share2 } from "lucide-react";
import { useMemo, useState } from "react";

import { shareBracket } from "@/app/bracket/actions";
import {
  type BracketNodeRef,
  CircularBracket,
  type SlotKey,
  slotKey,
  type TeamCode,
} from "@/components/circular-bracket";
import { Button } from "@/components/ui/button";
import type { Results } from "@/lib/results";
import { matchByNumber, teamById } from "@/lib/tournament";

type Picks = Record<number, TeamCode>;

// R32 occupants from the scoreboard. ESPN uses slot placeholders ("2A") until
// a side is settled, so only real team codes count as occupants.
function confirmedSlots(results: Results): Record<SlotKey, TeamCode> {
  const slots: Record<SlotKey, TeamCode> = {};
  for (const m of results.matches) {
    if (matchByNumber[m.n]?.round !== "R32") continue;
    for (const side of ["home", "away"] as const) {
      const code = m[side].code;
      if (teamById[code]) slots[`${m.n}:${side}`] = code;
    }
  }
  return slots;
}

// Played knockout matches, by match number → the actual winner.
function playedWinners(results: Results): Record<number, TeamCode> {
  const winners: Record<number, TeamCode> = {};
  const byNumber = new Map(results.matches.map((m) => [m.n, m]));
  for (const [num, side] of Object.entries(results.knockoutPicks)) {
    const match = byNumber.get(Number(num));
    const code = side === "home" ? match?.home.code : match?.away.code;
    if (code) winners[Number(num)] = code;
  }
  return winners;
}

/** Advance the tapped node's team into the next match. Confirmed results can't
 *  be overridden, and replacing a previous pick also clears the displaced team
 *  from every later round it had been advanced to. */
function advance(
  picks: Picks,
  node: BracketNodeRef,
  slots: Record<SlotKey, TeamCode>,
  results: Record<number, TeamCode>,
): Picks {
  const team = node.side
    ? slots[slotKey(node.match, node.side)]
    : (results[node.match] ?? picks[node.match]);
  const target = node.side ? node.match : matchByNumber[node.match].feedsInto;
  if (!team || !target || results[target] || picks[target] === team)
    return picks;
  const displaced = picks[target];
  const next = { ...picks, [target]: team };
  for (
    let m = matchByNumber[target].feedsInto;
    m && displaced && next[m] === displaced;
    m = matchByNumber[m].feedsInto
  )
    delete next[m];
  return next;
}

/** Saves the picks under a fresh share id and copies its link. The status is
 *  remembered with the picks it was for, so editing the bracket (a new picks
 *  object) resets the button to its idle label by itself. */
function ShareButton({ picks }: { picks: Picks }) {
  const [last, setLast] = useState<{
    picks: Picks;
    status: "saving" | "copied" | "error";
  } | null>(null);
  const status = last?.picks === picks ? last.status : undefined;

  const share = async () => {
    setLast({ picks, status: "saving" });
    try {
      const id = await shareBracket(picks);
      if (!id) throw new Error("picks rejected or storage unavailable");
      await navigator.clipboard.writeText(`${location.origin}/bracket/${id}`);
      const copied = { picks, status: "copied" as const };
      setLast(copied);
      // Back to shareable after the confirmation; only if nothing changed since.
      setTimeout(() => setLast((cur) => (cur === copied ? null : cur)), 2500);
    } catch (error) {
      console.error("bracket share failed:", error);
      setLast({ picks, status: "error" });
    }
  };

  if (status === "copied")
    return (
      <Button variant="outline" size="sm" disabled className="text-pick">
        <Check className="size-3.5" />
        Link copied
      </Button>
    );
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={share}
      disabled={status === "saving" || Object.keys(picks).length === 0}
    >
      <Share2 className="size-3.5" />
      {status === "error"
        ? "Couldn't share — try again"
        : "Share your prediction"}
    </Button>
  );
}

/** The board every bracket page draws on: the R32 occupants and the played
 *  winners, derived from the live results. */
function useBoard(results: Results) {
  return useMemo(
    () => ({ slots: confirmedSlots(results), winners: playedWinners(results) }),
    [results],
  );
}

/** A shared prediction laid over the live board, read-only: no tap-to-advance
 *  and no share button. */
export function SharedBracket({
  results,
  picks,
}: {
  results: Results;
  picks: Picks;
}) {
  const { slots, winners } = useBoard(results);
  return (
    <CircularBracket slots={slots} results={winners} predictions={picks} />
  );
}

/** The bracket as a build-your-own-prediction board: tap any team to advance
 *  it into the next round, all the way to the title. Sharing stores the picks
 *  and hands out a read-only /bracket/<id> link. */
export function BracketBuilder({ results }: { results: Results }) {
  const { slots, winners } = useBoard(results);
  const [picks, setPicks] = useState<Picks>({});
  return (
    <>
      <CircularBracket
        slots={slots}
        results={winners}
        predictions={picks}
        onNodeSelect={(node) =>
          setPicks((prev) => advance(prev, node, slots, winners))
        }
      />
      <div className="mt-5 flex justify-center">
        <ShareButton picks={picks} />
      </div>
    </>
  );
}

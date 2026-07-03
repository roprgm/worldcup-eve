"use client";

import { cn } from "cnfast";
import { Check, Copy, Share2 } from "lucide-react";
import { useMemo, useState } from "react";

import { shareBracket } from "@/app/arena/actions";
import {
  type BracketNodeRef,
  CircularBracket,
  type SlotKey,
  slotKey,
  type TeamCode,
} from "@/components/circular-bracket";
import { XIcon } from "@/components/icons";
import { Button, buttonVariants } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { buildBoard } from "@/lib/arena/board";
import type { Results } from "@/lib/results";
import { matchByNumber } from "@/lib/tournament";

type Picks = Record<number, TeamCode>;

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

const tweetHref = (name: string, url: string) =>
  `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `${name}'s 2026 World Cup bracket — can you beat it?`,
  )}&url=${encodeURIComponent(url)}`;

/** The link handed back once a bracket is shared: the URL to copy, a copy
 *  button, and a share-on-X button. */
function ShareResult({ name, url }: { name: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex w-full max-w-md flex-col gap-2">
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface py-1 pr-1 pl-2.5">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 bg-transparent text-left text-sm text-muted-foreground focus:outline-none"
          aria-label="Shareable link"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={copy}
          className={cn("shrink-0", copied && "text-pick")}
        >
          {copied ? (
            <Check className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <a
        href={tweetHref(name, url)}
        target="_blank"
        rel="noreferrer"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        <XIcon className="size-3.5" />
        Share on X
      </a>
    </div>
  );
}

/** The share flow, in a modal: enter a name, get back a link to copy or post to
 *  X. The result is remembered with the picks it was for, so editing the bracket
 *  (a new picks object) asks for a fresh link. */
function ShareBracket({ picks }: { picks: Picks }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<{
    picks: Picks;
    name: string;
    url: string;
  } | null>(null);

  const current = result?.picks === picks ? result : null;
  const empty = Object.keys(picks).length === 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (busy || !trimmed || empty) return;
    setBusy(true);
    setError(false);
    try {
      const id = await shareBracket(picks, trimmed);
      if (!id) throw new Error("picks rejected or storage unavailable");
      setResult({
        picks,
        name: trimmed,
        url: `${location.origin}/arena/b/${id}`,
      });
    } catch (err) {
      console.error("bracket share failed:", err);
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={empty}
      >
        <Share2 className="size-3.5" />
        Share your bracket
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={current ? "Your bracket is ready" : "Share your bracket"}
      >
        {current ? (
          <ShareResult name={current.name} url={current.url} />
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Add your name so your bracket can join the leaderboard, then share
              the link.
            </p>
            {/* biome-ignore lint/a11y/noAutofocus: the name field is the modal's sole purpose */}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Your name"
              aria-label="Your name"
              autoFocus
              className="h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-subtle-foreground focus:border-border-strong focus:outline-none"
            />
            <Button type="submit" disabled={busy || !name.trim() || empty}>
              <Share2 className="size-3.5" />
              {busy ? "Creating link…" : "Create shareable link"}
            </Button>
            {error && (
              <p className="text-xs text-red-400">
                Couldn’t share — try again.
              </p>
            )}
          </form>
        )}
      </Modal>
    </>
  );
}

/** The board every bracket page draws on: the R32 occupants and the played
 *  winners, derived from the live results. */
function useBoard(results: Results) {
  return useMemo(() => buildBoard(results), [results]);
}

/** A shared prediction laid over the live board, read-only: no tap-to-advance
 *  and no share button. With `reasoning` (match → why the pick was made), tapping
 *  a pick node reveals it in a popover. */
export function SharedBracket({
  results,
  picks,
  reasoning,
}: {
  results: Results;
  picks: Picks;
  reasoning?: Map<number, string>;
}) {
  const { slots, winners } = useBoard(results);
  const nodeNote = reasoning
    ? (ref: BracketNodeRef) => (ref.side ? undefined : reasoning.get(ref.match))
    : undefined;
  return (
    <CircularBracket
      slots={slots}
      results={winners}
      predictions={picks}
      nodeNote={nodeNote}
    />
  );
}

/** The bracket as a build-your-own-prediction board: tap any team to advance
 *  it into the next round, all the way to the title. Sharing stores the picks
 *  and hands out a read-only /arena/b/<id> link. */
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
        <ShareBracket picks={picks} />
      </div>
    </>
  );
}

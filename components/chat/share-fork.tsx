"use client";

import { Share2 } from "lucide-react";
import { useCallback, useState } from "react";
import { useChat } from "@/components/chat/chat-context";
import { buildTranscript } from "@/components/chat/messages";

// Visible everywhere except real production (local dev + Vercel preview).
// Vercel auto-exposes NEXT_PUBLIC_VERCEL_ENV; it's undefined in local dev.
const canPublish = process.env.NEXT_PUBLIC_VERCEL_ENV !== "production";

/** Admin affordance to publish the current chat as a shareable fork. Available
 *  in dev and preview; in production forks are read-only (the API enforces it). */
export function ShareFork() {
  const { agent } = useChat();
  const [busy, setBusy] = useState(false);

  const publish = useCallback(async () => {
    const slug = window.prompt("Fork slug (a-z, 0-9, -):")?.trim();
    if (!slug) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/forks/${slug}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          events: agent.events,
          transcript: buildTranscript(agent.data.messages),
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        window.alert(`Could not publish fork: ${data.error ?? res.status}`);
        return;
      }
      const url = `${window.location.origin}${data.url}`;
      await navigator.clipboard?.writeText(url).catch(() => {});
      window.prompt("Fork link (copied):", url);
    } finally {
      setBusy(false);
    }
  }, [agent]);

  if (!canPublish || agent.data.messages.length === 0) return null;

  return (
    <div className="mx-auto flex w-full max-w-4xl justify-end px-4 sm:px-6">
      <button
        type="button"
        onClick={publish}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[0.75rem] font-medium text-muted-foreground transition-colors hover:border-border-strong hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
      >
        <Share2 className="size-3.5" />
        {busy ? "Publishing…" : "Share fork"}
      </button>
    </div>
  );
}

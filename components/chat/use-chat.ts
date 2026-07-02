"use client";

import type { EveMessageData, UseEveAgentHelpers } from "eve/react";
import { useEveAgent } from "eve/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { activeQuestion } from "@/components/chat/messages";

type ChatAgent = UseEveAgentHelpers<EveMessageData>;
type SessionCursor = ChatAgent["session"];
type ChatEvents = ChatAgent["events"];

/** Everything the UI needs from a conversation. */
export type ChatView = ReturnType<typeof useChat>;

/** A conversation: the pending first message, then — as events arrive — the eve
 *  session cursor and the event log that rebuilds the UI. Held per-device in
 *  localStorage; the cursor alone is mirrored server-side so any browser can
 *  resume (the events are replayed from eve's durable session, not stored). */
export type SavedChat = {
  session?: SessionCursor;
  events?: ChatEvents;
  pendingMessage?: string;
  savedAt?: number;
};

// Trailing window before mirroring the cursor to the server — coalesces the
// burst of stream deltas into one small PUT of the settled handle.
const PUT_DEBOUNCE_MS = 800;

/** The conversation for `id`, resolved before the agent mounts so it starts
 *  from the restored session. Pages key their <Chat> by it. */
export function useChat(id: string, initial: SavedChat | null) {
  const agent = useEveAgent({
    initialSession: initial?.session,
    initialEvents: initial?.events,
    prepareSend: (input) => ({
      ...input,
      clientContext: {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }),
  });

  const mirrorCursor = useCursorMirror(id, initial?.session);

  // Persist every event so a refresh resumes anywhere. eve's cursor lags
  // mid-turn and resets when a stream aborts (reload, stop): pin streamIndex
  // to the log and never save a blank cursor over a good one.
  const cursor = useRef(initial?.session);
  useEffect(() => {
    if (agent.session.sessionId) cursor.current = agent.session;
    if (agent.events.length === 0) return;

    const session = {
      ...(cursor.current ?? agent.session),
      streamIndex: agent.events.length,
    };
    saveChat(id, {
      session,
      events: agent.events,
      // Kept until the session is resumable — a cut before that restarts it.
      pendingMessage: cursor.current ? undefined : initial?.pendingMessage,
    });
    if (session.sessionId) mirrorCursor(session);
  }, [id, agent.session, agent.events, initial, mirrorCursor]);

  // Deliver the pending first message. Effects can double-fire in dev; the
  // second send rejects (a turn is already running) and is dropped.
  useEffect(() => {
    if (initial?.pendingMessage)
      void agent.send({ message: initial.pendingMessage }).catch(() => {});
  }, []);

  // A spent session is terminal: the failure lives in the persisted event log,
  // so this stays true across a refresh even though status/error do not.
  const limitReached = agent.events.some(
    (event) =>
      event.type === "session.failed" && isTokenLimitFailure(event.data),
  );

  return {
    messages: agent.data.messages,
    status: agent.status,
    error: agent.error,
    limitReached,
    /** Send a message, answering any parked question. Sends during a running
     *  turn are rejected by the session and dropped. */
    send: (text: string) => {
      if (limitReached) return;
      const message = text.trim();
      if (!message) return;
      const question = activeQuestion(agent.data.messages);
      const payload = question
        ? { inputResponses: [{ requestId: question.requestId, text: message }] }
        : { message };
      void agent.send(payload).catch(() => {});
    },
    /** Answer a parked question by option id. */
    respond: (requestId: string, optionId: string) => {
      if (limitReached) return;
      void agent
        .send({ inputResponses: [{ requestId, optionId }] })
        .catch(() => {});
    },
    stop: agent.stop,
  };
}

/** Resolve the record to mount from. This device's own copy wins when present
 *  (instant, already holds the log); otherwise the server cursor is fetched and
 *  the history replayed from eve's durable session. Server-only until resolved,
 *  so the SSR markup matches the first client render. */
export function useChatInitial(id: string): {
  initial: SavedChat | null;
  ready: boolean;
} {
  const [state, setState] = useState<{
    initial: SavedChat | null;
    ready: boolean;
  }>({ initial: null, ready: false });

  useEffect(() => {
    let cancelled = false;
    const local = restoreChat(id);
    if (usable(local)) {
      setState({ initial: local, ready: true });
      return;
    }
    void resolveFromServer(id).then((restored) => {
      if (!cancelled) setState({ initial: restored ?? local, ready: true });
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}

// eve ends a session that exhausts its per-session token budget with a
// `session.failed` carrying this code (message as a fallback).
function isTokenLimitFailure(data: {
  code?: string;
  message?: string;
}): boolean {
  return (
    data.code === "SESSION_TOKEN_LIMIT_REACHED" ||
    /token limit/i.test(data.message ?? "")
  );
}

/** Start a new conversation: persist its first message, then claim its URL
 *  with pushState (shallow routing — nothing waits on the server); a refresh
 *  of that URL restores from the record. */
export function startNewChat(message: string): void {
  if (!message.trim()) return;
  const id = newChatId();
  saveChat(id, { pendingMessage: message });
  pruneChats();
  window.history.pushState(null, "", `/chat/${id}`);
}

// ── Server-side resume ──────────────────────────────────────────────────────

// A trailing, deduped PUT of the session cursor. Returns a stable callback the
// persist effect fires on every change; the settled cursor lands on the last
// change, and an unmount flushes anything still pending.
function useCursorMirror(id: string, seed: SessionCursor | undefined) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<SessionCursor | null>(null);
  const lastKey = useRef<string | null>(seed ? cursorKey(seed) : null);

  const flush = useCallback(() => {
    const next = pending.current;
    if (!next || cursorKey(next) === lastKey.current) return;
    lastKey.current = cursorKey(next);
    putServerCursor(id, next);
  }, [id]);

  const mirror = useCallback(
    (session: SessionCursor) => {
      if (cursorKey(session) === lastKey.current) return;
      pending.current = session;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, PUT_DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      flush();
    },
    [flush],
  );

  return mirror;
}

const cursorKey = (c: SessionCursor) =>
  `${c.sessionId ?? ""}:${c.continuationToken ?? ""}:${c.streamIndex}`;

// Blob reads are eventually consistent right after a write, so a chat that does
// have a cursor can 404 for a second or two. Retry a few times before treating
// the miss as "no server record" (a brand-new chat resolves on the first pass).
const CURSOR_RETRIES = 5;
const CURSOR_RETRY_MS = 400;

async function fetchServerCursor(id: string): Promise<SessionCursor | null> {
  for (let attempt = 0; attempt < CURSOR_RETRIES; attempt += 1) {
    try {
      const res = await fetch(`/api/chat/${id}`, { cache: "no-store" });
      if (res.ok) return (await res.json()) as SessionCursor;
      if (res.status !== 404) return null;
    } catch {}
    if (attempt < CURSOR_RETRIES - 1)
      await new Promise((resolve) => setTimeout(resolve, CURSOR_RETRY_MS));
  }
  return null;
}

// keepalive so a cursor flushed on unmount survives the navigation.
function putServerCursor(id: string, cursor: SessionCursor): void {
  void fetch(`/api/chat/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(cursor),
    keepalive: true,
  }).catch(() => {});
}

// Rebuild a fresh browser's view from the server cursor by replaying eve's
// durable event log (same-origin, so the withEve proxy handles auth).
async function resolveFromServer(id: string): Promise<SavedChat | null> {
  const session = await fetchServerCursor(id);
  if (!session?.sessionId) return null;
  const events = await replayEvents(session.sessionId, session.streamIndex);
  return { session, events };
}

// The stream replays the backlog then stays open, and the final line may not be
// newline-terminated yet — so stop at the turn boundary (the log's known tail)
// and cap the whole read with a deadline so a resume never hangs.
const REPLAY_TIMEOUT_MS = 4000;
const BOUNDARY = new Set([
  "session.waiting",
  "session.completed",
  "session.failed",
]);

async function replayEvents(
  sessionId: string,
  count: number,
): Promise<ChatEvents> {
  const events: unknown[] = [];
  if (count <= 0) return events as ChatEvents;
  const abort = new AbortController();
  const deadline = setTimeout(() => abort.abort(), REPLAY_TIMEOUT_MS);
  try {
    const res = await fetch(
      `/eve/v1/session/${sessionId}/stream?startIndex=0`,
      {
        cache: "no-store",
        signal: abort.signal,
      },
    );
    if (!res.ok || !res.body) return events as ChatEvents;
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done = false;
    const take = (line: string) => {
      if (!line) return;
      try {
        const event = JSON.parse(line);
        events.push(event);
        if (BOUNDARY.has(event.type) || events.length >= count) done = true;
      } catch {}
    };
    try {
      while (!done) {
        const chunk = await reader.read();
        if (chunk.value)
          buffer += decoder.decode(chunk.value, { stream: true });
        let nl = buffer.indexOf("\n");
        while (nl >= 0) {
          take(buffer.slice(0, nl).trim());
          buffer = buffer.slice(nl + 1);
          nl = buffer.indexOf("\n");
        }
        if (chunk.done) {
          take(buffer.trim());
          break;
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
  } catch {}
  clearTimeout(deadline);
  return events as ChatEvents;
}

function usable(chat: SavedChat | null): boolean {
  return Boolean(
    chat &&
      (chat.session?.sessionId ||
        chat.pendingMessage ||
        (chat.events?.length ?? 0) > 0),
  );
}

// ── Saved conversations ─────────────────────────────────────────────────────

const PREFIX = "wc26-chat:";
const LAST_KEY = "wc26-chat-last";
const MAX_CHATS = 8;

// crypto-random so the URL — which server-side storage turns into a resume
// handle — can't be walked. Longer than the old 8 chars, no dashes.
function newChatId(): string {
  const alphabet =
    "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  let id = "";
  for (const byte of bytes) id += alphabet[byte % alphabet.length];
  return id;
}

function loadChat(id: string): SavedChat | null {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + id) ?? "null");
  } catch {
    return null;
  }
}

// Best-effort: private mode just loses local resumability.
function saveChat(id: string, chat: Omit<SavedChat, "savedAt">): void {
  try {
    localStorage.setItem(
      PREFIX + id,
      JSON.stringify({ ...chat, savedAt: Date.now() }),
    );
    localStorage.setItem(LAST_KEY, id);
  } catch {}
}

// Drop the oldest beyond MAX_CHATS; the count only grows in startNewChat.
function pruneChats(): void {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith(PREFIX))
      .map((key) => ({ key, at: loadChat(key.slice(PREFIX.length))?.savedAt }))
      .sort((a, b) => (b.at ?? 0) - (a.at ?? 0))
      .slice(MAX_CHATS)
      .forEach(({ key }) => localStorage.removeItem(key));
  } catch {}
}

/** The most recently used chat id — where the nav "Chat" link returns to. */
export function lastChatId(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

const SETTLED = new Set([
  "session.waiting",
  "session.completed",
  "session.failed",
]);

/** The saved local record, ready to mount. A log cut mid-turn without a cursor
 *  (eve mints one at the first turn boundary) can only restart from the pending
 *  message; with a cursor it mounts as-is — the next send backfills the tail. */
function restoreChat(id: string): SavedChat | null {
  const saved = loadChat(id);
  const last = saved?.events?.at(-1);
  if (!saved || !last || SETTLED.has(last.type) || saved.session?.sessionId)
    return saved;
  return { pendingMessage: saved.pendingMessage, savedAt: saved.savedAt };
}

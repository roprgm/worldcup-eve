"use client";

import type { EveMessageData, UseEveAgentHelpers } from "eve/react";
import { useEveAgent } from "eve/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { activeQuestion } from "@/components/chat/messages";

type ChatAgent = UseEveAgentHelpers<EveMessageData>;

/** Everything the UI needs from a conversation. */
export type ChatView = ReturnType<typeof useChat>;

/** A conversation on this device: the pending first message, then — as events
 *  arrive — the eve session cursor and the event log that rebuilds the UI. */
type SavedChat = {
  session?: ChatAgent["session"];
  events?: ChatAgent["events"];
  pendingMessage?: string;
  savedAt: number;
};

// False on the server and during hydration (so the markup matches); true from
// the first render of a client-side navigation.
const never = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    never,
    () => true,
    () => false,
  );

/** The conversation for `id`, restored from this device. Pages key their
 *  <Chat> by it, so each mount owns one eve session. */
export function useChat(id: string) {
  const [initial] = useState(() => restoreChat(id));
  const hydrated = useHydrated();

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

  // Persist every event so a refresh resumes anywhere. eve's cursor lags
  // mid-turn and resets when a stream aborts (reload, stop): pin streamIndex
  // to the log and never save a blank cursor over a good one.
  const cursor = useRef(initial?.session);
  useEffect(() => {
    if (agent.session.sessionId) cursor.current = agent.session;
    if (agent.events.length > 0)
      saveChat(id, {
        session: {
          ...(cursor.current ?? agent.session),
          streamIndex: agent.events.length,
        },
        events: agent.events,
        // Kept until the session is resumable — a cut before that restarts it.
        pendingMessage: cursor.current ? undefined : initial?.pendingMessage,
      });
  }, [id, agent.session, agent.events]);

  // Deliver the pending first message. Effects can double-fire in dev; the
  // second send rejects (a turn is already running) and is dropped.
  useEffect(() => {
    if (initial?.pendingMessage)
      void agent.send({ message: initial.pendingMessage }).catch(() => {});
  }, []);

  // A spent session is terminal: the failure lives in the persisted event log,
  // so this stays true across a refresh even though status/error do not. Gated
  // by `hydrated` like `messages`, since the server has no restored events —
  // reporting it before hydration would mismatch the server-rendered markup.
  const limitReached =
    hydrated &&
    agent.events.some(
      (event) =>
        event.type === "session.failed" && isTokenLimitFailure(event.data),
    );

  return {
    messages: hydrated ? agent.data.messages : [],
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
  const id = Math.random().toString(36).slice(2, 10);
  saveChat(id, { pendingMessage: message });
  pruneChats();
  window.history.pushState(null, "", `/chat/${id}`);
}

// ── Saved conversations ─────────────────────────────────────────────────────

const PREFIX = "wc26-chat:";
const LAST_KEY = "wc26-chat-last";
const MAX_CHATS = 8;

function loadChat(id: string): SavedChat | null {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + id) ?? "null");
  } catch {
    return null;
  }
}

// Best-effort: private mode just loses resumability.
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

/** The most recently used chat id, but only if it was used within `maxAgeMs`. */
export function recentChatId(maxAgeMs: number): string | null {
  try {
    const id = localStorage.getItem(LAST_KEY);
    if (!id) return null;
    const savedAt = loadChat(id)?.savedAt ?? 0;
    return Date.now() - savedAt < maxAgeMs ? id : null;
  } catch {
    return null;
  }
}

const SETTLED = new Set([
  "session.waiting",
  "session.completed",
  "session.failed",
]);

/** The saved record, ready to mount. A log cut mid-turn without a cursor (eve
 *  mints one at the first turn boundary) can only restart from the pending
 *  message; with a cursor it mounts as-is — the next send backfills the tail. */
function restoreChat(id: string): SavedChat | null {
  const saved = loadChat(id);
  const last = saved?.events?.at(-1);
  if (!saved || !last || SETTLED.has(last.type) || saved.session?.sessionId)
    return saved;
  return { pendingMessage: saved.pendingMessage, savedAt: saved.savedAt };
}

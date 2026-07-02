"use client";

import type { EveMessageData, UseEveAgentHelpers } from "eve/react";
import { useEveAgent } from "eve/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { activeQuestion } from "@/components/chat/messages";

type ChatAgent = UseEveAgentHelpers<EveMessageData>;

/** Everything the UI needs from a conversation. */
export type ChatView = ReturnType<typeof useChat>;

/** A conversation saved on this device: just the pending first message before
 *  the server has seen it, then — reconciled as events arrive — the eve
 *  session cursor and the event log that rebuilds the UI. A refresh at any
 *  point resumes from whichever shape is there. */
type SavedChat = {
  session?: ChatAgent["session"];
  events?: ChatAgent["events"];
  pendingMessage?: string;
  savedAt: number;
};

// React's own "past hydration?" signal: false on the server and during the
// hydration render (so the markup matches), true from the very first render
// of a client-side navigation — nothing is deferred there.
const never = () => () => {};
const useHydrated = () =>
  useSyncExternalStore(
    never,
    () => true,
    () => false,
  );

/** The conversation for `id`. Pages key their <Chat> by it, so each mount owns
 *  one eve session, restored from this device. Storage doesn't exist on the
 *  server, so restored messages only show once hydrated. */
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

  // Persist every event so a refresh resumes anywhere, even mid-stream. Two
  // cursor quirks to compensate: the session's streamIndex lags mid-turn (pin
  // it to the log), and an aborted stream (reload, stop) resets the cursor —
  // remember the last state that addressed the session and never save a blank
  // one over it.
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
        // The first message stays on the record until the session is
        // resumable — a cut before that can only restart from it.
        pendingMessage: cursor.current ? undefined : initial?.pendingMessage,
      });
  }, [id, agent.session, agent.events]);

  // Deliver the pending first message. Effects can double-fire in dev; the
  // second send rejects (a turn is already running) and is dropped.
  useEffect(() => {
    if (initial?.pendingMessage)
      void agent.send({ message: initial.pendingMessage }).catch(() => {});
  }, []);

  return {
    messages: hydrated ? agent.data.messages : [],
    status: agent.status,
    error: agent.error,
    /** Send a message, answering any parked question. A send while a turn is
     *  running is rejected by the session and dropped. */
    send: (text: string) => {
      const message = text.trim();
      if (!message) return;
      const question = activeQuestion(agent.data.messages);
      const payload = question
        ? { inputResponses: [{ requestId: question.requestId, text: message }] }
        : { message };
      void agent.send(payload).catch(() => {});
    },
    /** Answer a parked question by option id. */
    respond: (requestId: string, optionId: string) =>
      void agent
        .send({ inputResponses: [{ requestId, optionId }] })
        .catch(() => {}),
    stop: agent.stop,
  };
}

/** Start a new conversation: persist the first message — before any server
 *  contact — and claim its URL. The pushState is Next's shallow routing: the
 *  chat renders with no server round trip (see app/page.tsx), while a refresh
 *  of that URL server-renders and restores from the record. */
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

/** Write the whole record — a later save with server state replaces the
 *  pending shape. Best-effort: private mode just loses resumability. */
function saveChat(id: string, chat: Omit<SavedChat, "savedAt">): void {
  try {
    localStorage.setItem(
      PREFIX + id,
      JSON.stringify({ ...chat, savedAt: Date.now() }),
    );
    localStorage.setItem(LAST_KEY, id);
  } catch {}
}

/** Cap stored conversations, dropping the oldest — the count only grows when
 *  a chat starts, so this runs there rather than on every save. */
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

/** The saved record, ready to mount. One special case: a reload doesn't stop
 *  a turn, and a log cut mid-turn before eve minted a resumable cursor (that
 *  happens at the first turn boundary) can only restart — go back to the
 *  still-pending first message. A cut log WITH a cursor mounts as-is: the
 *  next send reconnects the stream and backfills the missing tail. */
function restoreChat(id: string): SavedChat | null {
  const saved = loadChat(id);
  const last = saved?.events?.at(-1);
  if (!saved || !last || SETTLED.has(last.type) || saved.session?.sessionId)
    return saved;
  return { pendingMessage: saved.pendingMessage, savedAt: saved.savedAt };
}

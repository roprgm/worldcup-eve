"use client";

import type { EveMessageData, UseEveAgentHelpers } from "eve/react";
import { useEveAgent } from "eve/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";
import { activeQuestion } from "@/components/chat/messages";

type Agent = UseEveAgentHelpers<EveMessageData>;

type ChatContextValue = {
  agent: Agent;
  send: (message: string) => void;
  start: (message: string) => void;
};

type SavedChat = {
  id: string;
  session?: Agent["session"];
  events?: Agent["events"];
};

const ChatContext = createContext<ChatContextValue | null>(null);

const STORAGE_KEY = "wc26-chat";
const newChatId = () => Math.random().toString(36).slice(2, 10);
const chatIdFromPath = (path: string) =>
  path.match(/^\/chat\/([^/]+)/)?.[1] ?? null;

// Restore the saved chat — but only under its own `/chat/<id>` (a fresh id stays
// empty) or on a non-chat page (so the Chat link can return to it). `/` is fresh.
function loadChat(): SavedChat | null {
  if (typeof window === "undefined") return null;
  const path = window.location.pathname;
  if (path === "/") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  let saved: SavedChat;
  try {
    saved = JSON.parse(raw) as SavedChat;
  } catch {
    return null;
  }
  const urlId = chatIdFromPath(path);
  return urlId && urlId !== saved.id ? null : saved;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [restored] = useState(loadChat);

  const agent = useEveAgent({
    initialSession: restored?.session,
    initialEvents: restored?.events,
    prepareSend: (input) => ({
      ...input,
      clientContext: {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }),
    // Persist when a turn settles, keyed by the chat in the URL. Skip empty
    // turns so a failed first message can't clobber the saved chat.
    onFinish: ({ session, events }) => {
      const id = chatIdFromPath(window.location.pathname);
      if (id && events.length > 0) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ id, session, events }),
        );
      }
    },
  });

  const send = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message) return;
      // While a question is parked, a plain message would be dropped as
      // "ignored"; route it back as the answer to the pending request.
      const question = activeQuestion(agent.data.messages);
      // Don't start a new message while a turn is still running — the user must
      // let it finish or hit stop first. (eve's store also throws here; this
      // makes the no-op explicit so a stray submit can't interleave a turn.)
      if (
        !question &&
        (agent.status === "submitted" || agent.status === "streaming")
      )
        return;
      const payload = question
        ? { inputResponses: [{ requestId: question.requestId, text: message }] }
        : { message };
      void agent.send(payload).catch(() => {});
    },
    [agent],
  );

  const start = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      agent.reset(); // start fresh even if a previous chat is still in context
      send(text); // optimistic message lands before the view swaps in
      // Update the URL without a route navigation: the conversation already
      // renders from shared context, so a real navigation only adds a flicker.
      window.history.pushState(null, "", `/chat/${newChatId()}`);
    },
    [agent, send],
  );

  return (
    <ChatContext.Provider value={{ agent, send, start }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error("useChat must be used within <ChatProvider>");
  return value;
}

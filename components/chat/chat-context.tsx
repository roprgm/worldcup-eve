"use client";

import type { EveMessageData, UseEveAgentHelpers } from "eve/react";
import { useEveAgent } from "eve/react";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { activeQuestion } from "@/components/chat/messages";

type Agent = UseEveAgentHelpers<EveMessageData>;

type ChatContextValue = {
  agent: Agent;
  send: (message: string) => void;
  start: (message: string) => void;
};

// A shared chat to fork from: the prior events render immediately, and the
// transcript is replayed as model context so the agent continues seamlessly.
export type ChatSeed = {
  events: Agent["events"];
  transcript: string;
};

type SavedChat = {
  id: string;
  session?: Agent["session"];
  events?: Agent["events"];
  transcript?: string;
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

export function ChatProvider({
  children,
  seed,
}: {
  children: ReactNode;
  seed?: ChatSeed;
}) {
  // A seeded fork ignores any saved chat and starts fresh from the seed.
  const [restored] = useState(() => (seed ? null : loadChat()));
  // Prior conversation injected as model context every turn: a fresh durable
  // session has no server-side history, so this is what makes the fork continue.
  const transcript = seed?.transcript ?? restored?.transcript;
  const adopted = useRef(false);

  const agent = useEveAgent({
    initialSession: seed ? undefined : restored?.session,
    initialEvents: seed ? seed.events : restored?.events,
    prepareSend: (input) => ({
      ...input,
      clientContext: {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(transcript ? { priorConversation: transcript } : {}),
      },
    }),
    // Persist when a turn settles, keyed by the chat in the URL. Skip empty
    // turns so a failed first message can't clobber the saved chat.
    onFinish: ({ session, events }) => {
      const id = chatIdFromPath(window.location.pathname);
      if (id && events.length > 0) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ id, session, events, transcript }),
        );
      }
    },
  });

  const send = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message) return;
      // On its first turn a fork adopts a normal `/chat/<id>` URL so it persists
      // and later resumes like any other local chat.
      if (seed && !adopted.current) {
        adopted.current = true;
        window.history.pushState(null, "", `/chat/${newChatId()}`);
      }
      // While a question is parked, a plain message would be dropped as
      // "ignored"; route it back as the answer to the pending request.
      const question = activeQuestion(agent.data.messages);
      const payload = question
        ? { inputResponses: [{ requestId: question.requestId, text: message }] }
        : { message };
      void agent.send(payload).catch(() => {});
    },
    [agent, seed],
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

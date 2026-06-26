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

type SavedChat = { session?: Agent["session"]; events?: Agent["events"] };

const ChatContext = createContext<ChatContextValue | null>(null);

const STORAGE_KEY = "wc26-chat";
const newChatId = () => Math.random().toString(36).slice(2, 10);

// Restore the last chat everywhere except `/`, which is always a fresh prompt.
function loadChat(): SavedChat | null {
  if (typeof window === "undefined" || window.location.pathname === "/") {
    return null;
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as SavedChat) : null;
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
    onFinish: ({ session, events }) =>
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ session, events })),
  });

  const send = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message) return;
      // While a question is parked, a plain message would be dropped as
      // "ignored"; route it back as the answer to the pending request.
      const question = activeQuestion(agent.data.messages);
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

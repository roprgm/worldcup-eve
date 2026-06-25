"use client";

import type { EveMessageData, UseEveAgentHelpers } from "eve/react";
import { useEveAgent } from "eve/react";
import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
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

const chatKey = (id: string) => `wc26-chat:${id}`;
const newChatId = () => Math.random().toString(36).slice(2, 10);

/** The chat id in a `/chat/<id>` path, or `null` anywhere else. */
function chatIdFromPath(pathname: string): string | null {
  return pathname.match(/^\/chat\/([^/]+)/)?.[1] ?? null;
}

function loadChat(id: string): SavedChat | null {
  const raw = localStorage.getItem(chatKey(id));
  return raw ? (JSON.parse(raw) as SavedChat) : null;
}

function saveChat(id: string, chat: SavedChat): void {
  localStorage.setItem(chatKey(id), JSON.stringify(chat));
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const id = chatIdFromPath(usePathname());

  const [restored] = useState(() =>
    typeof window === "undefined"
      ? null
      : loadChat(chatIdFromPath(window.location.pathname) ?? ""),
  );

  const agent = useEveAgent({
    initialSession: restored?.session,
    initialEvents: restored?.events,
    prepareSend: (input) => ({
      ...input,
      clientContext: {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }),
  });

  const { session, events } = agent;
  useEffect(() => {
    if (id) saveChat(id, { session, events });
  }, [id, session, events]);

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
      // Update the URL without a route navigation: the conversation already
      // renders from shared context, so a real navigation only adds a flicker.
      window.history.pushState(null, "", `/chat/${newChatId()}`);
      send(text);
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

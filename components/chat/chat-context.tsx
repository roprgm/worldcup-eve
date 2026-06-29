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
  // The chat held in memory, if any — the nav links back to it. Null on the
  // new-chat screen with nothing to resume.
  chatId: string | null;
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

// Restore the saved chat only when reloading its own `/chat/<id>` URL. Every
// other page (home, predictions, a fresh id) starts empty, so an old chat is
// never resurrected into memory where it could bleed into a new one.
function loadChat(): SavedChat | null {
  if (typeof window === "undefined") return null;
  const urlId = chatIdFromPath(window.location.pathname);
  if (!urlId) return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  let saved: SavedChat;
  try {
    saved = JSON.parse(raw) as SavedChat;
  } catch {
    return null;
  }
  return saved.id === urlId ? saved : null;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [restored] = useState(loadChat);
  // Only a chat with content is worth linking back to; a parse with no events
  // would otherwise resolve to a blank conversation.
  const [chatId, setChatId] = useState<string | null>(() =>
    restored?.events?.length ? restored.id : null,
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
      const message = text.trim();
      if (!message) return;
      const id = newChatId();
      // Reset clears the prior conversation synchronously at the store; then send
      // a plain message straight to the agent. Going through `send` here would
      // read a pre-reset snapshot and could misroute the first message as an
      // answer to a question parked in the old chat — that is the context bleed.
      agent.reset();
      setChatId(id);
      // Update the URL without a route navigation: the conversation already
      // renders from shared context, so a real navigation only adds a flicker.
      window.history.pushState(null, "", `/chat/${id}`);
      void agent.send({ message }).catch(() => {}); // optimistic message lands now
    },
    [agent],
  );

  return (
    <ChatContext.Provider value={{ agent, send, start, chatId }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error("useChat must be used within <ChatProvider>");
  return value;
}

"use client";

import type { EveMessageData, UseEveAgentHelpers } from "eve/react";
import { useEveAgent } from "eve/react";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { activeQuestion } from "@/components/chat/messages";

type Agent = UseEveAgentHelpers<EveMessageData>;

type ChatContextValue = {
  agent: Agent;
  /** Send a message in the open chat, or answer a pending question. */
  send: (text: string) => void;
  /** Open a fresh chat seeded with its first message. */
  start: (text: string) => void;
  /** Where the "Chat" nav should point: the open chat, or a new one. */
  chatHref: string;
};

type SavedChat = {
  id: string;
  session?: Agent["session"];
  events?: Agent["events"];
};

type Seed = { id: string; text: string };

const ChatContext = createContext<ChatContextValue | null>(null);

const STORAGE_KEY = "wc26-chat";
const newChatId = () => Math.random().toString(36).slice(2, 10);
const chatIdFromPath = (path: string) =>
  path.match(/^\/chat\/([^/]+)/)?.[1] ?? null;

function readSavedChat(): SavedChat | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedChat) : null;
  } catch {
    return null;
  }
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const seed = useRef<Seed | null>(null);

  // The URL is the single source of truth for which chat is open. The id is
  // sticky across non-chat routes (e.g. visiting Predictions) so the live
  // conversation survives, and clears only on the home / new-chat screen.
  const [chatId, setChatId] = useState<string | null>(() =>
    chatIdFromPath(pathname),
  );
  useEffect(() => {
    const id = chatIdFromPath(pathname);
    if (id) setChatId(id);
    else if (pathname === "/") setChatId(null);
  }, [pathname]);

  const start = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message) return;
      const id = newChatId();
      seed.current = { id, text: message };
      router.push(`/chat/${id}`);
    },
    [router],
  );

  // Remount the session whenever the chat changes, so the agent's state always
  // matches the URL — no stale messages bleeding from a previous conversation.
  return (
    <ChatSession
      key={chatId ?? "new"}
      chatId={chatId}
      seed={seed}
      start={start}
    >
      {children}
    </ChatSession>
  );
}

function ChatSession({
  chatId,
  seed,
  start,
  children,
}: {
  chatId: string | null;
  seed: RefObject<Seed | null>;
  start: (text: string) => void;
  children: ReactNode;
}) {
  // Restore from storage only when the URL points at the saved chat; a fresh id
  // (or the home screen) starts empty.
  const [restored] = useState(() => {
    const saved = readSavedChat();
    return chatId && saved?.id === chatId ? saved : null;
  });

  const agent = useEveAgent({
    initialSession: restored?.session,
    initialEvents: restored?.events,
    prepareSend: (input) => ({
      ...input,
      clientContext: {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }),
    // Persist when a turn settles. Skip empty turns so a failed first message
    // can't clobber the saved chat.
    onFinish: ({ session, events }) => {
      if (chatId && events.length > 0) {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ id: chatId, session, events } satisfies SavedChat),
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
      const payload = question
        ? { inputResponses: [{ requestId: question.requestId, text: message }] }
        : { message };
      void agent.send(payload).catch(() => {});
    },
    [agent],
  );

  // Deliver the message that opened this chat. The guard — empty, idle, and the
  // seed still targets this id — makes it idempotent: it can't double-send into
  // one session, yet a Strict Mode remount with a fresh empty agent re-delivers.
  const status = agent.status;
  const isEmpty = agent.data.messages.length === 0;
  useEffect(() => {
    const pending = seed.current;
    if (restored || pending?.id !== chatId) return;
    if (!isEmpty || status !== "ready") return;
    void agent.send({ message: pending.text }).catch(() => {});
  }, [agent, chatId, restored, seed, isEmpty, status]);

  const value = useMemo<ChatContextValue>(
    () => ({ agent, send, start, chatHref: chatId ? `/chat/${chatId}` : "/" }),
    [agent, send, start, chatId],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error("useChat must be used within <ChatProvider>");
  return value;
}

"use client";

import type { EveMessage, EveMessageData, UseEveAgentHelpers } from "eve/react";
import { useEveAgent } from "eve/react";
import type { HandleMessageStreamEvent, SessionState } from "eve/client";
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { activeQuestion } from "@/components/chat/messages";
import {
  readCursor,
  streamHistory,
  writeCursor,
} from "@/components/chat/session-store";

type Agent = UseEveAgentHelpers<EveMessageData>;

type ChatContextValue = {
  agent: Agent;
  messages: readonly EveMessage[];
  status: Agent["status"];
  sessionId: string | undefined;
  send: (text: string) => void;
  newChat: () => void;
  restore: (sessionId: string) => void;
};

const ChatContext = createContext<ChatContextValue | null>(null);

// What the agent is constructed with. `key` remounts it when the conversation
// identity changes (new chat, or a restore finishing).
type Conversation = {
  key: string;
  events?: readonly HandleMessageStreamEvent[];
  session?: SessionState;
};

type Props = {
  conversation: Conversation;
  onSession: (id: string | undefined) => void;
  newChat: () => void;
  restore: (sessionId: string) => void;
  children: ReactNode;
};

/** Owns the live agent for one conversation. Remounted (via `key`) whenever the
 *  conversation identity changes, so it always boots from the right history. */
function ConversationProvider({
  conversation,
  onSession,
  newChat,
  restore,
  children,
}: Props) {
  const router = useRouter();
  const namedRef = useRef(conversation.session?.sessionId);

  const agent = useEveAgent({
    initialEvents: conversation.events,
    initialSession: conversation.session,
    prepareSend: (input) => ({
      ...input,
      clientContext: {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }),
    // Persist the cursor each turn, and move the URL to /chat/<id> the first time
    // a turn earns a server session, so a refresh can replay it.
    onSessionChange: (session) => {
      onSession(session.sessionId);
      if (!session.sessionId) return;
      writeCursor(session);
      if (session.sessionId !== namedRef.current) {
        namedRef.current = session.sessionId;
        if (window.location.pathname !== `/chat/${session.sessionId}`) {
          router.replace(`/chat/${session.sessionId}`);
        }
      }
    },
  });

  useEffect(() => {
    onSession(agent.session.sessionId);
  }, [onSession, agent.session.sessionId]);

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

  const value = useMemo<ChatContextValue>(
    () => ({
      agent,
      messages: agent.data.messages,
      status: agent.status,
      sessionId: agent.session.sessionId,
      send,
      newChat,
      restore,
    }),
    [agent, send, newChat, restore],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

const freshConversation = (seq: number): Conversation => ({
  key: `new:${seq}`,
});

export function ChatProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [conversation, setConversation] = useState<Conversation>(() =>
    freshConversation(0),
  );
  const seq = useRef(0);
  const currentId = useRef<string | undefined>(undefined);
  const replay = useRef<AbortController | null>(null);

  const onSession = useCallback((id: string | undefined) => {
    currentId.current = id;
  }, []);

  const newChat = useCallback(() => {
    replay.current?.abort();
    seq.current += 1;
    currentId.current = undefined;
    setConversation(freshConversation(seq.current));
  }, []);

  // Load a conversation by id: skip if it's already live, replay its history
  // from the server otherwise, and fall back to a new chat if it can't be read.
  const restore = useCallback(
    (sessionId: string) => {
      if (currentId.current === sessionId) return;
      const cursor = readCursor(sessionId);
      if (!cursor?.streamIndex) {
        router.replace("/");
        return;
      }
      currentId.current = sessionId;
      replay.current?.abort();
      const controller = new AbortController();
      replay.current = controller;
      setConversation({ key: `${sessionId}:loading` });
      streamHistory(cursor, controller.signal)
        .then((events) => {
          if (controller.signal.aborted) return;
          if (events.length === 0) {
            router.replace("/");
            return;
          }
          setConversation({
            key: `${sessionId}:ready`,
            events,
            session: cursor,
          });
        })
        .catch(() => {
          if (!controller.signal.aborted) router.replace("/");
        });
    },
    [router],
  );

  return (
    <ConversationProvider
      key={conversation.key}
      conversation={conversation}
      onSession={onSession}
      newChat={newChat}
      restore={restore}
    >
      {children}
    </ConversationProvider>
  );
}

export function useChat(): ChatContextValue {
  const value = useContext(ChatContext);
  if (!value) throw new Error("useChat must be used within <ChatProvider>");
  return value;
}

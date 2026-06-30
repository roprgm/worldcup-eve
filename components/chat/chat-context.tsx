"use client";

import type { EveMessageData, UseEveAgentHelpers } from "eve/react";
import { useEveAgent } from "eve/react";
import { useRouter } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { activeQuestion } from "@/components/chat/messages";

type Agent = UseEveAgentHelpers<EveMessageData>;

type SavedChat = {
  session?: Agent["session"];
  events?: Agent["events"];
};

const STORAGE_KEY = "wc26-chat";

function loadChat(): SavedChat | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SavedChat;
  } catch {
    return null;
  }
}

function clearChat() {
  if (typeof window !== "undefined") localStorage.removeItem(STORAGE_KEY);
}

// --- Navigation layer ---------------------------------------------------------
// There is a single active chat, owned by the agent layer below. This layer
// drives "new chat": it bumps an epoch so the agent remounts into a fresh eve
// session (eve's reset re-seeds the original session, so only a remount is truly
// fresh). The epoch changes ONLY on new-chat/start — never on route navigation —
// so moving between pages keeps an in-flight conversation alive.

type ChatNavValue = {
  // Whether a chat exists to return to. Drives the nav link and guards `/chat`
  // from rendering a blank conversation. Once true it stays true: going home
  // keeps the chat; only starting another one replaces it.
  active: boolean;
  // Begin a chat from the home screen: replace any previous one and open the
  // chat route with the first message queued.
  start: (message: string) => void;
};

const ChatNavContext = createContext<ChatNavValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [epoch, setEpoch] = useState(0);
  // A saved chat means there's one to resume; otherwise we start inactive.
  const [active, setActive] = useState(() => loadChat() !== null);
  const pending = useRef<string | null>(null);
  const router = useRouter();

  const start = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message) return;
      clearChat(); // a new chat replaces any previous one
      pending.current = message;
      setActive(true);
      setEpoch((e) => e + 1); // remount the agent into a fresh session
      router.push("/chat");
    },
    [router],
  );

  const takePending = useCallback(() => {
    const message = pending.current;
    pending.current = null;
    return message ?? undefined;
  }, []);

  return (
    <ChatNavContext.Provider value={{ active, start }}>
      <ChatSession key={epoch} takePending={takePending}>
        {children}
      </ChatSession>
    </ChatNavContext.Provider>
  );
}

export function useChatNav(): ChatNavValue {
  const value = useContext(ChatNavContext);
  if (!value) throw new Error("useChatNav must be used within <ChatProvider>");
  return value;
}

// --- Agent layer --------------------------------------------------------------
// One `useEveAgent` for the single active chat, mounted in the layout so it
// survives route changes. Seeded from localStorage so a reload resumes; remounts
// (via the epoch key) into a fresh session on new-chat.

type ChatAgentValue = {
  agent: Agent;
  send: (message: string) => void;
};

const ChatAgentContext = createContext<ChatAgentValue | null>(null);

function ChatSession({
  children,
  takePending,
}: {
  children: ReactNode;
  takePending: () => string | undefined;
}) {
  const [initial] = useState(loadChat);

  const agent = useEveAgent({
    initialSession: initial?.session,
    initialEvents: initial?.events,
    prepareSend: (input) => ({
      ...input,
      clientContext: {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }),
    // Persist when a turn settles. Skip empty turns so a failed first message
    // can't clobber the saved chat.
    onFinish: ({ session, events }) => {
      if (events.length > 0)
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ session, events }));
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
      // let it finish or hit stop first.
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

  // Send the queued first message once, after the fresh store mounts.
  const sendRef = useRef(send);
  sendRef.current = send;
  useEffect(() => {
    const first = takePending();
    if (first) sendRef.current(first);
  }, [takePending]);

  return (
    <ChatAgentContext.Provider value={{ agent, send }}>
      {children}
    </ChatAgentContext.Provider>
  );
}

export function useChatAgent(): ChatAgentValue {
  const value = useContext(ChatAgentContext);
  if (!value)
    throw new Error("useChatAgent must be used within <ChatProvider>");
  return value;
}

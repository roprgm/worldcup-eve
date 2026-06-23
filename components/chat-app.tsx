"use client";

import { useEveAgent } from "eve/react";
import { useEffect, useState } from "react";
import { Chat } from "@/components/chat";
import { Header } from "@/components/header";

const storageKey = (id: string) => `wc26-chat:${id}`;
const randomId = () => Math.random().toString(36).slice(2, 10);

export function ChatApp({ id }: { id?: string }) {
  // Decide what to render only after mount, so the server and first client render
  // match — reading localStorage during render would trip a hydration mismatch.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (id && !localStorage.getItem(storageKey(id))) {
      window.location.replace("/"); // unknown id → home
      return;
    }
    setReady(true);
  }, [id]);

  if (!ready) {
    return (
      <div className="relative z-10 flex h-dvh flex-col overflow-hidden">
        <Header />
      </div>
    );
  }
  return <Session id={id} />;
}

function Session({ id }: { id?: string }) {
  // Client-only (mounted after the gate above), so reading localStorage is safe.
  const [saved] = useState(() => {
    const raw = id ? localStorage.getItem(storageKey(id)) : null;
    return raw ? JSON.parse(raw) : {};
  });

  const agent = useEveAgent({
    initialSession: saved.session,
    initialEvents: saved.events,
    prepareSend: (input) => ({
      ...input,
      clientContext: {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }),
  });

  // First message of a new chat → mint a short id and reflect it in the URL.
  const [chatId, setChatId] = useState(id);
  useEffect(() => {
    if (!chatId && agent.session?.sessionId) {
      const next = randomId();
      setChatId(next);
      window.history.pushState(null, "", `/s/${next}`);
    }
  }, [chatId, agent.session?.sessionId]);

  // Save the conversation under its id after each turn settles.
  useEffect(() => {
    if (chatId && agent.status === "ready") {
      localStorage.setItem(
        storageKey(chatId),
        JSON.stringify({ session: agent.session, events: agent.events }),
      );
    }
  }, [chatId, agent.status, agent.session, agent.events]);

  return (
    <div className="relative z-10 flex h-dvh flex-col overflow-hidden">
      <Header />
      <Chat agent={agent} />
    </div>
  );
}

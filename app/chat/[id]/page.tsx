"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

// The chat seeds its eve session from localStorage, so it renders client-side
// only; the route still server-renders the app shell around it.
const Chat = dynamic(() => import("@/components/chat/chat"), { ssr: false });

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  return <Chat key={id} id={id} />;
}

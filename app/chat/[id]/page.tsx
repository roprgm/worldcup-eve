"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

// The chat seeds its eve session from localStorage at mount, so it renders on
// the client only; the route still server-renders the app shell around it.
const Chat = dynamic(
  () => import("@/components/chat/chat").then((m) => m.Chat),
  {
    ssr: false,
  },
);

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  return <Chat key={id} id={id} />;
}

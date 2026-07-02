"use client";

import { useParams } from "next/navigation";

import { Chat } from "@/components/chat/chat";

export default function ChatPage() {
  const { id } = useParams<{ id: string }>();
  return <Chat key={id} id={id} />;
}

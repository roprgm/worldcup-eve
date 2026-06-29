"use client";

import type { ReactNode } from "react";
import { ChatView } from "@/components/chat/chat-view";
import { Header } from "@/components/header";
import { useInstantPathname } from "@/components/instant-navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useInstantPathname();

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header />
      {pathname.startsWith("/chat/") ? <ChatView /> : children}
    </div>
  );
}

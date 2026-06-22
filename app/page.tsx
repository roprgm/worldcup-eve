"use client";

import { useEveAgent } from "eve/react";
import { Chat } from "@/components/chat";
import { Header } from "@/components/header";

export default function Page() {
  const agent = useEveAgent({
    prepareSend: (input) => ({
      ...input,
      clientContext: {
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }),
  });

  return (
    <div className="relative z-10 flex h-dvh flex-col overflow-hidden">
      <Header />
      <Chat agent={agent} />
    </div>
  );
}

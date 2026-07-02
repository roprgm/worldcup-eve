"use client";

import { usePathname } from "next/navigation";

import { Chat } from "@/components/chat/chat";
import { Home } from "@/components/home";

// Starting a chat claims its /chat/<id> URL with pushState (shallow routing),
// so this page keeps rendering — as the conversation — until a real
// navigation; direct loads of /chat/<id> go through its own route.
export default function HomePage() {
  const pathname = usePathname();
  const id = pathname.startsWith("/chat/")
    ? pathname.slice("/chat/".length)
    : null;
  return id ? <Chat key={id} id={id} /> : <Home />;
}

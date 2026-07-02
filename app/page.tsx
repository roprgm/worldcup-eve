"use client";

import { usePathname } from "next/navigation";

import { Chat } from "@/components/chat/chat";
import { Home } from "@/components/home";

// Starting a chat claims its /chat/<id> URL with history.pushState — Next's
// shallow routing, so nothing waits on the server — and this page renders the
// conversation in place until a real navigation happens. A direct load or
// refresh of /chat/<id> renders through its own route instead.
export default function HomePage() {
  const pathname = usePathname();
  const id = pathname.startsWith("/chat/")
    ? pathname.slice("/chat/".length)
    : null;
  return id ? <Chat key={id} id={id} /> : <Home />;
}

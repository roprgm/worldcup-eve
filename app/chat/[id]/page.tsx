import { ChatContent } from "@/app/chat/[id]/chat-content";

// The id is meaningless on the server (it only keys client-side state), so serve
// one static shell for every chat instead of rendering each id on demand.
export const dynamic = "force-static";

export default function Page() {
  return <ChatContent />;
}

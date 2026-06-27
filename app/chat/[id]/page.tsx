import { Chat } from "@/components/chat/chat";

// The id names a durable Eve session. The conversation replays from the server
// on load (see ChatProvider), so the page just hands the id to the chat surface.
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Chat pendingSessionId={id} />;
}

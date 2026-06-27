import { notFound } from "next/navigation";
import { StarterChat } from "@/app/s/[slug]/starter-chat";
import { buildStarter } from "@/lib/starters/starters";

// The slug is parsed per request into a starter chat, so this can't be static.
export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const starter = buildStarter(slug);
  if (!starter) notFound();
  return (
    <StarterChat
      seed={{ events: starter.events, transcript: starter.transcript }}
    />
  );
}

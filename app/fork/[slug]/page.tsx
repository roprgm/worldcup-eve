import { notFound } from "next/navigation";
import { ForkChat } from "@/app/fork/[slug]/fork-chat";
import { loadFork } from "@/lib/forks/store";

// Reads the shared chat from the store at request time, so it can't be static.
export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const seed = await loadFork(slug);
  if (!seed) notFound();
  return (
    <ForkChat seed={{ events: seed.events, transcript: seed.transcript }} />
  );
}

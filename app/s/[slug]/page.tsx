import { notFound } from "next/navigation";
import { StarterChat } from "@/app/s/[slug]/starter-chat";
import { buildStarter } from "@/lib/starters/starters";

// The slug is parsed per request into a starter prompt, so this can't be static.
export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const prompt = buildStarter(slug);
  if (!prompt) notFound();
  return <StarterChat prompt={prompt} />;
}

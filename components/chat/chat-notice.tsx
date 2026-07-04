import type { EveMessageData, UseEveAgentHelpers } from "eve/react";
import { Clock, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Notice } from "@/components/ui/notice";

/** Picks the right notice for the current turn state, or nothing. The
 *  demo-limit notice is driven by `limitReached` (persisted in the event log)
 *  so it survives a refresh, unlike the transient `status`/`error`. */
export function ChatNotice({
  status,
  error,
  limitReached,
}: {
  status: UseEveAgentHelpers<EveMessageData>["status"];
  error: Error | undefined;
  limitReached: boolean;
}) {
  if (limitReached) return <DemoLimitNotice />;
  if (status !== "error") return null;
  return isRateLimited(error) ? <RateLimitNotice /> : <UnreachableNotice />;
}

function isRateLimited(error: Error | undefined): boolean {
  if (!error) return false;
  const status = (error as { status?: number }).status;
  return (
    status === 429 ||
    /\b429\b|rate limit|too many requests/i.test(error.message)
  );
}

function DemoLimitNotice() {
  return (
    <Notice icon={Sparkles} tone="amber">
      You’ve reached the free usage limit for this demo conversation.{" "}
      <Link href="/" className="font-medium underline underline-offset-2">
        Start a new chat
      </Link>{" "}
      to keep going.
    </Notice>
  );
}

function RateLimitNotice() {
  return (
    <Notice icon={Clock} tone="amber">
      You’re sending messages quickly. This public demo is limited. Take a short
      break and try again in a moment.
    </Notice>
  );
}

function UnreachableNotice() {
  return (
    <Notice icon={TriangleAlert} tone="red">
      Couldn’t reach the agent. Please try again later.
    </Notice>
  );
}

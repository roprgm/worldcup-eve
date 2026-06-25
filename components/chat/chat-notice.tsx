import type { EveMessageData, UseEveAgentHelpers } from "eve/react";
import { Clock, TriangleAlert } from "lucide-react";
import { Notice } from "@/components/ui/notice";

/** Picks the right notice for the current turn state, or nothing. */
export function ChatNotice({
  status,
  error,
}: {
  status: UseEveAgentHelpers<EveMessageData>["status"];
  error: Error | undefined;
}) {
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

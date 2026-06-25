import { cn } from "cnfast";
import type { EveMessage } from "eve/react";
import { TriangleAlert } from "lucide-react";
import { Loader } from "@/components/ai-elements/loader";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import {
  assistantActivityLabel,
  messageText,
} from "@/components/chat/messages";

/** A loader with an inline status label, for in-progress activity. */
export function ActivityStatus({ label }: { label: string }) {
  return (
    <div className="flex min-h-7 items-center gap-2.5 text-[0.8125rem] leading-snug text-subtle-foreground">
      <span>{label}</span>
      <Loader className="shrink-0" />
    </div>
  );
}

export function MessageRow({
  message,
  index,
  animate,
  active,
}: {
  message: EveMessage;
  index: number;
  animate: boolean;
  active: boolean;
}) {
  return (
    <Message
      from={message.role}
      className={cn(animate && "animate-fade-up")}
      style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
    >
      {message.role === "user" ? (
        <UserMessage message={message} />
      ) : (
        <AssistantMessage message={message} active={active} />
      )}
    </Message>
  );
}

export function PendingRow() {
  return (
    <Message from="assistant">
      <MessageAvatar streaming />
      <MessageContent from="assistant">
        <ActivityStatus label="Thinking" />
      </MessageContent>
    </Message>
  );
}

function UserMessage({ message }: { message: EveMessage }) {
  return <MessageContent from="user">{messageText(message)}</MessageContent>;
}

function AssistantMessage({
  message,
  active,
}: {
  message: EveMessage;
  active: boolean;
}) {
  return (
    <>
      <MessageAvatar streaming={active} />
      <MessageContent from="assistant">
        <AssistantBody message={message} active={active} />
      </MessageContent>
    </>
  );
}

/** Streamed answer text once it arrives, otherwise a live activity label. */
function AssistantBody({
  message,
  active,
}: {
  message: EveMessage;
  active: boolean;
}) {
  const text = messageText(message);
  if (text) return <Response>{text}</Response>;
  if (!active) return <SettledWithoutReply />;
  return <ActivityStatus label={assistantActivityLabel(message)} />;
}

function SettledWithoutReply() {
  return (
    <div className="flex min-h-7 items-center gap-2.5 text-[0.8125rem] leading-snug text-subtle-foreground">
      <TriangleAlert className="size-4 shrink-0 text-muted-foreground" />
      <span>The agent stopped before sending a reply.</span>
    </div>
  );
}

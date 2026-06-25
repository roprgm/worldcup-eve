import { cn } from "cnfast";
import type { EveMessage } from "eve/react";
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
  streaming,
}: {
  message: EveMessage;
  index: number;
  animate: boolean;
  streaming: boolean;
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
        <AssistantMessage message={message} streaming={streaming} />
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
  streaming,
}: {
  message: EveMessage;
  streaming: boolean;
}) {
  return (
    <>
      <MessageAvatar streaming={streaming} />
      <MessageContent from="assistant">
        <AssistantBody message={message} />
      </MessageContent>
    </>
  );
}

/** Streamed answer text once it arrives, otherwise a live activity label. */
function AssistantBody({ message }: { message: EveMessage }) {
  const text = messageText(message);
  if (text) return <Response>{text}</Response>;
  return <ActivityStatus label={assistantActivityLabel(message)} />;
}

import type { EveDynamicToolPart, EveMessage } from "eve/react";
import { cn } from "cnfast";
import { useChat } from "@/components/chat/chat-context";
import {
  MessageWidgets,
  messageWidgets,
} from "@/components/chat/message-widgets";
import {
  assistantActivityLabel,
  messageText,
  questionPart,
} from "@/components/chat/messages";
import { BallIcon } from "@/components/icons";
import { Bubble } from "@/components/ui/bubble";
import { Loader } from "@/components/ui/loader";
import { Message, MessageAvatar } from "@/components/ui/message";
import { Response } from "@/components/ui/response";
import { Suggestion, Suggestions } from "@/components/ui/suggestion";

function AssistantAvatar({ streaming }: { streaming: boolean }) {
  return (
    <MessageAvatar className={cn(streaming && "wc-streaming")}>
      <BallIcon className="size-[15px]" />
    </MessageAvatar>
  );
}

/** A label and typing dots — the agent's "working on it" state. */
function ActivityIndicator({ label }: { label: string }) {
  return (
    <div className="flex min-h-7 items-center gap-2.5 text-[0.8125rem] leading-snug text-subtle-foreground">
      <span>{label}</span>
      <Loader className="shrink-0" />
    </div>
  );
}

/** Stands in for the reply before the assistant message exists. */
export function PendingRow({ label }: { label: string }) {
  return (
    <Message align="start">
      <AssistantAvatar streaming />
      <Bubble variant="ghost" className="pt-0.5">
        <ActivityIndicator label={label} />
      </Bubble>
    </Message>
  );
}

export function MessageRow({
  message,
  busy,
}: {
  message: EveMessage;
  busy: boolean;
}) {
  if (message.role === "user") {
    return (
      <Message align="end">
        <Bubble variant="secondary" align="end">
          {messageText(message)}
        </Bubble>
      </Message>
    );
  }

  const streaming = busy && message.metadata?.status === "streaming";
  return (
    <Message align="start">
      <AssistantAvatar streaming={streaming} />
      <Bubble variant="ghost" className="pt-0.5">
        <AssistantBody message={message} busy={busy} />
      </Bubble>
    </Message>
  );
}

function AssistantBody({
  message,
  busy,
}: {
  message: EveMessage;
  busy: boolean;
}) {
  const question = questionPart(message);
  const widgets = messageWidgets(message);
  const text = visibleAssistantText(messageText(message), widgets.length > 0);

  // Empty while a reply is in flight: show the loader in place — it becomes the
  // answer here, without swapping rows.
  if (!question && !text && widgets.length === 0) {
    return busy ? (
      <ActivityIndicator label={assistantActivityLabel(message)} />
    ) : null;
  }

  return (
    <div className="flex flex-col gap-3">
      {question ? <QuestionPrompt part={question} /> : null}
      {text ? <Response>{text}</Response> : null}
      <MessageWidgets specs={widgets} />
    </div>
  );
}

// When the reply also draws a widget, drop the leading list/table the model
// tends to repeat as prose so the data isn't shown twice.
function visibleAssistantText(text: string, hasWidgets: boolean): string {
  const trimmed = text.trim();
  if (!hasWidgets || trimmed.length === 0) return trimmed;
  return trimmed
    .split(/\n\s*(?:[-*•]|\d+[.)])\s+/u, 1)[0]
    .split(/\n\s*\|/u, 1)[0]
    .trim();
}

function QuestionPrompt({ part }: { part: EveDynamicToolPart }) {
  const { agent, status } = useChat();
  const request = part.toolMetadata?.eve?.inputRequest;
  if (!request) return null;

  const response = part.toolMetadata?.eve?.inputResponse;
  const options = request.options ?? [];
  const chosen = response?.optionId
    ? (options.find((o) => o.id === response.optionId)?.label ??
      response.optionId)
    : response?.text;
  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex flex-col gap-2.5">
      <Response>{request.prompt}</Response>
      {chosen ? (
        <span className="w-fit rounded-full border border-border bg-surface px-3 py-1.5 text-[0.8125rem] text-muted-foreground">
          {chosen}
        </span>
      ) : options.length > 0 ? (
        <Suggestions>
          {options.map((option) => (
            <Suggestion
              key={option.id}
              suggestion={option.label}
              onSelect={() => {
                if (busy) return;
                void agent
                  .send({
                    inputResponses: [
                      { requestId: request.requestId, optionId: option.id },
                    ],
                  })
                  .catch(() => {});
              }}
            />
          ))}
        </Suggestions>
      ) : null}
    </div>
  );
}

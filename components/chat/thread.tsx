"use client";

import { cn } from "cnfast";
import type { EveDynamicToolPart, EveMessage } from "eve/react";
import { useState } from "react";
import { ChatMarkdown } from "@/components/chat/rich-markdown";
import {
  assistantActivityLabel,
  isBusy,
  isRenderableMessage,
  messageKey,
  messageText,
  questionPart,
} from "@/components/chat/messages";
import type { ChatView } from "@/components/chat/use-chat";
import { BallIcon } from "@/components/icons";
import { Markdown } from "@/components/ui/markdown";
import { Bubble, Message, MessageAvatar } from "@/components/ui/message";
import { Suggestion, Suggestions } from "@/components/ui/suggestion";

export function Thread({ chat }: { chat: ChatView }) {
  const { messages, status } = chat;
  const busy = isBusy(status);
  const lastAssistant = messages.findLast((m) => m.role === "assistant");

  // Until the reply's text starts streaming, its bubble shows the activity
  // loader, which morphs into the answer in place — no layout shift.
  const awaitingReply =
    busy && (!lastAssistant || !messageText(lastAssistant).trim());
  const activity = awaitingReply ? assistantActivityLabel(lastAssistant) : null;

  const rows = messages.filter(
    (m) => isRenderableMessage(m) || (busy && m === lastAssistant),
  );

  return (
    <div className="flex flex-col gap-6">
      {rows.map((message, index) =>
        message.role === "user" ? (
          <Message
            key={messageKey(message, index)}
            align="end"
            className="animate-fade-up"
            style={fadeDelay(index)}
          >
            <Bubble>{messageText(message)}</Bubble>
          </Message>
        ) : (
          <AssistantRow
            key={message.id}
            respond={chat.respond}
            message={message}
            index={index}
            streaming={busy && message.metadata?.status === "streaming"}
            activity={message === lastAssistant ? activity : null}
          />
        ),
      )}

      {/* The turn is submitted but no assistant message exists yet. */}
      {activity && !lastAssistant && (
        <AssistantRow
          respond={chat.respond}
          streaming
          activity={activity}
          index={rows.length}
        />
      )}
    </div>
  );
}

function AssistantRow({
  respond,
  message,
  index,
  streaming,
  activity,
}: {
  respond: ChatView["respond"];
  message?: EveMessage;
  index: number;
  streaming: boolean;
  activity: string | null;
}) {
  const question = message ? questionPart(message) : undefined;
  const text = message ? messageText(message) : "";

  // Decide the entrance animation once, at mount. A row that first appears
  // mid-flight (activity loader or streaming text) settles in place — the avatar
  // pulse and shimmer already signal it — and must never slide afterwards, so a
  // label change (Thinking → Almost done) or the turn finishing can't re-trigger
  // the entrance and jump.
  const [animateEntrance] = useState(() => !streaming && !activity);

  return (
    <Message
      align="start"
      className={cn(animateEntrance && "animate-fade-up")}
      style={animateEntrance ? fadeDelay(index) : undefined}
    >
      <MessageAvatar streaming={streaming}>
        <BallIcon className="size-[18px]" />
      </MessageAvatar>
      <Bubble variant="ghost">
        <div className="flex flex-col gap-3">
          {question && <QuestionPrompt respond={respond} part={question} />}
          {text && <ChatMarkdown>{text}</ChatMarkdown>}
          {!text && !question && activity && <Activity label={activity} />}
        </div>
      </Bubble>
    </Message>
  );
}

const fadeDelay = (index: number) => ({
  animationDelay: `${Math.min(index, 6) * 30}ms`,
});

function Activity({ label }: { label: string }) {
  return (
    <div className="flex min-h-7 items-center text-sm leading-snug">
      <span className="wc-shimmer">{label}</span>
    </div>
  );
}

function QuestionPrompt({
  respond,
  part,
}: {
  respond: ChatView["respond"];
  part: EveDynamicToolPart;
}) {
  const request = part.toolMetadata?.eve?.inputRequest;
  if (!request) return null;
  const response = part.toolMetadata?.eve?.inputResponse;
  const options = request.options ?? [];
  const chosen = response?.optionId
    ? (options.find((o) => o.id === response.optionId)?.label ??
      response.optionId)
    : response?.text;

  return (
    <div className="flex flex-col gap-2.5">
      <Markdown>{request.prompt}</Markdown>
      {chosen ? (
        <span className="w-fit rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-muted-foreground">
          {chosen}
        </span>
      ) : options.length > 0 ? (
        <Suggestions>
          {options.map((option) => (
            <Suggestion
              key={option.id}
              suggestion={option.label}
              onSelect={() => respond(request.requestId, option.id)}
            />
          ))}
        </Suggestions>
      ) : null}
    </div>
  );
}

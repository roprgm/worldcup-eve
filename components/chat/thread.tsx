"use client";

import { cn } from "cnfast";
import type { EveDynamicToolPart, EveMessage } from "eve/react";
import { useState } from "react";
import { useChat } from "@/components/chat/chat-context";
import {
  MessageWidgets,
  messageWidgets,
} from "@/components/chat/message-widgets";
import {
  assistantActivityLabel,
  isRenderableMessage,
  messageKey,
  messageText,
  questionPart,
} from "@/components/chat/messages";
import { BallIcon } from "@/components/icons";
import { Markdown } from "@/components/ui/markdown";
import { Bubble, Message, MessageAvatar } from "@/components/ui/message";
import { Suggestion, Suggestions } from "@/components/ui/suggestion";

export function Thread() {
  const { agent } = useChat();
  const messages = agent.data.messages;
  const isBusy = agent.status === "submitted" || agent.status === "streaming";
  const lastAssistant = messages.findLast((m) => m.role === "assistant");

  // The reply is "in flight" until its text starts streaming. Until then the
  // assistant bubble shows the activity loader, which morphs into the answer in
  // place — so only one indicator can ever show and there's no layout shift.
  const activity =
    isBusy && (!lastAssistant || messageText(lastAssistant).trim().length === 0)
      ? lastAssistant
        ? assistantActivityLabel(lastAssistant)
        : "Thinking..."
      : null;

  const rows = messages.filter(
    (m) =>
      isRenderableMessage(m) ||
      messageWidgets(m).length > 0 ||
      (isBusy && m === lastAssistant),
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
            message={message}
            index={index}
            streaming={isBusy && message.metadata?.status === "streaming"}
            activity={message === lastAssistant ? activity : null}
          />
        ),
      )}

      {/* The turn is submitted but no assistant message exists yet. */}
      {activity && !lastAssistant && (
        <AssistantRow streaming activity={activity} index={rows.length} />
      )}
    </div>
  );
}

function AssistantRow({
  message,
  index,
  streaming,
  activity,
}: {
  message?: EveMessage;
  index: number;
  streaming: boolean;
  activity: string | null;
}) {
  const question = message ? questionPart(message) : undefined;
  const widgets = message ? messageWidgets(message) : [];
  const text = message
    ? visibleText(messageText(message), widgets.length > 0)
    : "";

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
          {question && <QuestionPrompt part={question} />}
          {text && <Markdown>{text}</Markdown>}
          {!text && !question && activity && <Activity label={activity} />}
          {/* Hold widgets until the reply finishes: while text streams in above
              them, an already-drawn widget would otherwise get pushed down. */}
          {!streaming && <MessageWidgets specs={widgets} />}
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
    <div className="flex min-h-7 items-center text-[0.8125rem] leading-snug">
      <span className="wc-shimmer">{label}</span>
    </div>
  );
}

function QuestionPrompt({ part }: { part: EveDynamicToolPart }) {
  const { agent } = useChat();
  const request = part.toolMetadata?.eve?.inputRequest;
  if (!request) return null;
  const response = part.toolMetadata?.eve?.inputResponse;
  const options = request.options ?? [];
  const chosen = response?.optionId
    ? (options.find((o) => o.id === response.optionId)?.label ??
      response.optionId)
    : response?.text;
  const busy = agent.status === "submitted" || agent.status === "streaming";

  return (
    <div className="flex flex-col gap-2.5">
      <Markdown>{request.prompt}</Markdown>
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

// Drop a trailing list/table that a widget already renders, so it isn't shown
// twice. Keeps the lead-in prose.
function visibleText(text: string, hasWidgets: boolean): string {
  const trimmed = text.trim();
  if (!hasWidgets || trimmed.length === 0) return trimmed;
  return trimmed
    .split(/\n\s*(?:[-*•]|\d+[.)])\s+/u, 1)[0]
    .split(/\n\s*\|/u, 1)[0]
    .trim();
}

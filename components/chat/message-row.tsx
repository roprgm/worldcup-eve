import { cn } from "cnfast";
import type { EveDynamicToolPart, EveMessage } from "eve/react";
import { useChat } from "@/components/chat/chat-context";
import {
  hasRenderableContent,
  MessageWidgets,
  messageWidgets,
} from "@/components/chat/message-widgets";
import {
  assistantActivityLabel,
  messageText,
  questionPart,
} from "@/components/chat/messages";
import { BallIcon } from "@/components/icons";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Loader } from "@/components/ui/loader";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/message";
import { Response } from "@/components/ui/response";
import { Suggestion, Suggestions } from "@/components/ui/suggestion";

export function UserRow({ message }: { message: EveMessage }) {
  return (
    <Message align="end" className="animate-fade-up">
      <MessageContent>
        <Bubble>
          <BubbleContent>{messageText(message)}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

/** The assistant's turn. Until its first prose, question, or widget arrives it
 *  shows a labelled loader in place — same row, so nothing shifts when content
 *  lands. `message` is absent only in the brief gap before the reply starts. */
export function AssistantRow({
  message,
  streaming,
}: {
  message?: EveMessage;
  streaming: boolean;
}) {
  const ready = message ? hasRenderableContent(message) : false;
  return (
    <Message className="animate-fade-up">
      <MessageAvatar className={cn(streaming && "wc-streaming")}>
        <BallIcon className="size-[15px]" />
      </MessageAvatar>
      <MessageContent className="min-w-0 flex-1 pt-0.5">
        {ready && message ? (
          <AssistantBody message={message} />
        ) : (
          <Activity
            label={message ? assistantActivityLabel(message) : "Thinking"}
          />
        )}
      </MessageContent>
    </Message>
  );
}

function Activity({ label }: { label: string }) {
  return (
    <div className="flex min-h-7 items-center gap-2.5 text-[0.8125rem] leading-snug text-subtle-foreground">
      <span>{label}</span>
      <Loader className="shrink-0" />
    </div>
  );
}

function AssistantBody({ message }: { message: EveMessage }) {
  const question = questionPart(message);
  const widgets = messageWidgets(message);
  const text = visibleAssistantText(messageText(message), widgets.length > 0);
  return (
    <div className="flex flex-col gap-3">
      {question ? <QuestionPrompt part={question} /> : null}
      {text ? <Response>{text}</Response> : null}
      <MessageWidgets specs={widgets} />
    </div>
  );
}

function visibleAssistantText(text: string, hasWidgets: boolean): string {
  const trimmed = text.trim();
  if (!hasWidgets || trimmed.length === 0) return trimmed;

  return trimmed
    .split(/\n\s*(?:[-*•]|\d+[.)])\s+/u, 1)[0]
    .split(/\n\s*\|/u, 1)[0]
    .trim();
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
      <Response>{request.prompt}</Response>
      {chosen ? (
        <Bubble variant="muted">
          <BubbleContent className="text-[0.8125rem]">{chosen}</BubbleContent>
        </Bubble>
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

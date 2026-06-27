import type { EveDynamicToolPart, EveMessage } from "eve/react";
import { Loader } from "@/components/ai-elements/loader";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ai-elements/message";
import { Response } from "@/components/ai-elements/response";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { useChat } from "@/components/chat/chat-context";
import {
  MessageWidgets,
  messageWidgets,
} from "@/components/chat/message-widgets";
import { messageText, questionPart } from "@/components/chat/messages";

export function MessageRow({
  message,
  index,
  streaming,
}: {
  message: EveMessage;
  index: number;
  streaming: boolean;
}) {
  return (
    <Message
      from={message.role}
      className="animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
    >
      {message.role === "user" ? (
        <MessageContent from="user">{messageText(message)}</MessageContent>
      ) : (
        <>
          <MessageAvatar streaming={streaming} />
          <MessageContent from="assistant">
            <AssistantBody message={message} />
          </MessageContent>
        </>
      )}
    </Message>
  );
}

export function ActivityRow({ label }: { label: string }) {
  return (
    <Message from="assistant">
      <MessageAvatar streaming />
      <MessageContent from="assistant">
        <div className="flex min-h-7 items-center gap-2.5 text-[0.8125rem] leading-snug text-subtle-foreground">
          <span>{label}</span>
          <Loader className="shrink-0" />
        </div>
      </MessageContent>
    </Message>
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

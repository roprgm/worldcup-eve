import type { EveDynamicToolPart, EveMessage } from "eve/react";
import { useChat } from "@/components/chat/chat-context";
import { MessageWidgets } from "@/components/chat/message-widgets";
import { messageText, questionPart } from "@/components/chat/messages";
import { BallIcon } from "@/components/icons";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ui/message";
import { Response } from "@/components/ui/response";
import { Suggestion, Suggestions } from "@/components/ui/suggestion";

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
        <Bubble>
          <BubbleContent>{messageText(message)}</BubbleContent>
        </Bubble>
      ) : (
        <>
          <MessageAvatar streaming={streaming}>
            <BallIcon className="size-[15px]" />
          </MessageAvatar>
          <MessageContent>
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
      <MessageAvatar streaming>
        <BallIcon className="size-[15px]" />
      </MessageAvatar>
      <MessageContent>
        <span className="wc-shimmer flex min-h-7 items-center text-[0.8125rem] leading-snug">
          {label}
        </span>
      </MessageContent>
    </Message>
  );
}

function AssistantBody({ message }: { message: EveMessage }) {
  const question = questionPart(message);
  const text = messageText(message);
  return (
    <div className="flex flex-col gap-2.5">
      {question ? <QuestionPrompt part={question} /> : null}
      {text ? <Response>{text}</Response> : null}
      <MessageWidgets message={message} />
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

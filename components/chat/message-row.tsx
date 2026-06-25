import { cn } from "cnfast";
import type { EveMessage, EveMessageInputRequest } from "eve/react";
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
  assistantActivityLabel,
  messageText,
  pendingQuestion,
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
        <AssistantBody message={message} streaming={streaming} />
      </MessageContent>
    </>
  );
}

/**
 * A pending question, the streamed answer text, or — only while the turn is in
 * flight — a live activity label. A settled, text-less message is filtered out
 * upstream, so the loader never strands.
 */
function AssistantBody({
  message,
  streaming,
}: {
  message: EveMessage;
  streaming: boolean;
}) {
  const question = pendingQuestion(message);
  if (question) return <QuestionPrompt request={question} />;
  const text = messageText(message);
  if (text) return <Response>{text}</Response>;
  if (streaming)
    return <ActivityStatus label={assistantActivityLabel(message)} />;
  return null;
}

/** An `ask_question` prompt: the question plus its options as answer chips. */
function QuestionPrompt({ request }: { request: EveMessageInputRequest }) {
  const { agent } = useChat();
  const busy = agent.status === "submitted" || agent.status === "streaming";
  const options = request.options ?? [];
  return (
    <div className="flex flex-col gap-2.5">
      <Response>{request.prompt}</Response>
      {options.length > 0 ? (
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
      ) : (
        <p className="text-[0.8125rem] text-subtle-foreground">
          Reply below to continue.
        </p>
      )}
    </div>
  );
}

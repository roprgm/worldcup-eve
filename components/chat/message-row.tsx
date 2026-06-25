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
import { messageText, pendingQuestion } from "@/components/chat/messages";

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

/** The single in-flight progress indicator, shown below the last bubble. */
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
  const question = pendingQuestion(message);
  if (question) return <QuestionPrompt request={question} />;
  return <Response>{messageText(message)}</Response>;
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

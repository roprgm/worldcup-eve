import type { Spec } from "@json-render/core";
import { JSONUIProvider, Renderer } from "@json-render/react";
import { cn } from "cnfast";
import type { EveMessage, EveMessageData, UseEveAgentHelpers } from "eve/react";
import { Clock, type LucideIcon, TriangleAlert } from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import {
  Message,
  MessageAvatar,
  MessageContent,
} from "@/components/ai-elements/message";
import { PromptInput } from "@/components/ai-elements/prompt-input";
import { Response } from "@/components/ai-elements/response";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { BallIcon } from "@/components/icons";
import { matchResultsSpec } from "@/components/render/match-card";
import { registry } from "@/components/render/registry";

const SUGGESTIONS = [
  "Which matches are playing today?",
  "Who is more likely to win the next match?",
  "Where did Argentina play their last match?",
  "Who got the red card in Belgium vs Iran?",
];

const TURN_TIMEOUT_MS = 45_000;

/** Concatenate the renderable text parts of an Eve message. */
function messageText(message: EveMessage): string {
  let text = "";
  for (const part of message.parts) {
    if (part.type === "text") text += part.text;
  }
  return text;
}

function messageKey(message: EveMessage, index: number): string {
  if (message.role !== "user") return message.id;
  return `${message.role}-${index}`;
}

/** Match-card specs for any get_match_results tool calls in this message. */
function matchResultSpecs(
  message: EveMessage,
): Array<{ id: string; spec: Spec }> {
  const specs: Array<{ id: string; spec: Spec }> = [];
  for (const part of message.parts) {
    if (
      part.type === "dynamic-tool" &&
      part.toolName === "get_match_results" &&
      part.state === "output-available"
    ) {
      const spec = matchResultsSpec(part.output);
      if (spec) specs.push({ id: part.toolCallId, spec });
    }
  }
  return specs;
}

function isEmptyStreamingAssistantMessage(message: EveMessage): boolean {
  return (
    message.role === "assistant" &&
    message.metadata?.status === "streaming" &&
    messageText(message).length === 0
  );
}

function assistantActivityLabel(message: EveMessage): string {
  const latestTool = message.parts
    .filter((part) => part.type === "dynamic-tool")
    .at(-1);

  if (latestTool) {
    const kind = latestTool.toolMetadata?.eve?.kind;
    const name = latestTool.toolMetadata?.eve?.name ?? latestTool.toolName;

    if (latestTool.state === "output-error") return "Couldn’t read match data";
    if (kind === "load-skill") return "Checking the World Cup schedule";
    if (/standings/i.test(name)) return "Checking group standings";
    if (/match|result|detail/i.test(name)) return "Checking match data";
    if (latestTool.state === "output-available") return "Preparing the answer";
    return "Checking match context";
  }

  if (message.parts.some((part) => part.type === "reasoning")) {
    return "Thinking through the match context";
  }

  if (message.parts.some((part) => part.type === "step-start")) {
    return "Starting the reply";
  }

  return "Starting the agent";
}

function latestUserTurnId(messages: readonly EveMessage[]): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user") return message.metadata?.turnId;
  }
}

/**
 * True when the backend rejected the turn with a 429 (rate limited). Eve surfaces
 * the original `ClientError` (with its HTTP `status`) on `agent.error`, so read it
 * structurally — falling back to the message text.
 */
function isRateLimited(error: Error | undefined): boolean {
  if (!error) return false;
  const status = (error as { status?: number }).status;
  return (
    status === 429 ||
    /\b429\b|rate limit|too many requests/i.test(error.message)
  );
}

export function Chat({ agent }: { agent: UseEveAgentHelpers<EveMessageData> }) {
  const { data, status, send, stop, error } = agent;
  const messages = data.messages;
  const [input, setInput] = useState("");
  const [turnTimedOut, setTurnTimedOut] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const isBusy = status === "submitted" || status === "streaming";
  const visibleMessages = turnTimedOut
    ? messages.filter((message) => !isEmptyStreamingAssistantMessage(message))
    : messages;
  const activeTurnId = latestUserTurnId(messages);
  const hasAssistantMessageForActiveTurn = messages.some(
    (message) =>
      message.role === "assistant" && message.metadata?.turnId === activeTurnId,
  );
  const latestMessage = visibleMessages.at(-1);
  const showEmptyState = visibleMessages.length === 0 && !isBusy;
  const showPendingRow =
    !turnTimedOut &&
    isBusy &&
    latestMessage?.role !== "assistant" &&
    (activeTurnId === undefined || !hasAssistantMessageForActiveTurn);

  useEffect(() => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (!isBusy) return;

    timeoutRef.current = window.setTimeout(() => {
      setTurnTimedOut(true);
      stop();
    }, TURN_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [isBusy, stop]);

  const submit = (text: string) => {
    const message = text.trim();
    if (!message || isBusy) return;
    setTurnTimedOut(false);
    // Errors surface via `status === 'error'`; swallow the rejection here.
    void send({ message }).catch(() => {});
  };

  const handleSubmit = () => {
    submit(input);
    setInput("");
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation>
        <ConversationContent>
          {showEmptyState ? (
            <EmptyState onSelect={submit} />
          ) : (
            <div className="flex flex-col gap-6">
              {visibleMessages.map((message, index) => (
                <MessageRow
                  key={messageKey(message, index)}
                  message={message}
                  index={index}
                  animate={!isEmptyStreamingAssistantMessage(message)}
                  streaming={
                    message.metadata?.status === "streaming" && !turnTimedOut
                  }
                />
              ))}
              {showPendingRow && <PendingRow key="pending-assistant" />}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="shrink-0 border-t border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-3xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.85rem)] sm:px-6">
          {turnTimedOut ? (
            <Notice icon={TriangleAlert} tone="red">
              The agent took too long to respond. Please try again.
            </Notice>
          ) : (
            status === "error" &&
            (isRateLimited(error) ? (
              <Notice icon={Clock} tone="amber">
                You’re sending messages quickly. This public demo is limited to{" "}
                <span className="font-medium text-amber-100">20 / min</span> —
                take a short break and try again in a moment.
              </Notice>
            ) : (
              <Notice icon={TriangleAlert} tone="red">
                Couldn’t reach the agent. Please try again.
              </Notice>
            ))
          )}
          <PromptInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            onStop={stop}
            status={status}
          />
          <div className="mt-2.5 flex flex-col items-center gap-1.5 text-center font-mono">
            <p className="text-[10.5px] tracking-wide text-subtle-foreground">
              WC26.chat can make mistakes — verify important details
            </p>
            <EveAttribution />
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageRow({
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
  const isUser = message.role === "user";
  const text = messageText(message);
  const specs = isUser ? [] : matchResultSpecs(message);
  return (
    <Message
      from={message.role}
      className={animate ? "wc-animate-in" : undefined}
      style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
    >
      {!isUser && <MessageAvatar streaming={streaming} />}
      <MessageContent from={message.role}>
        {isUser ? (
          text
        ) : (
          <>
            {text ? <Response>{text}</Response> : null}
            {specs.map(({ id, spec }) => (
              // Renderer needs the json-render context providers; the bare
              // <Renderer> shown in the README throws useVisibility otherwise.
              <JSONUIProvider key={id} registry={registry}>
                <Renderer spec={spec} registry={registry} />
              </JSONUIProvider>
            ))}
            {!text && specs.length === 0 ? (
              <ActivityStatus label={assistantActivityLabel(message)} />
            ) : null}
          </>
        )}
      </MessageContent>
    </Message>
  );
}

function PendingRow() {
  return (
    <Message from="assistant">
      <MessageAvatar streaming />
      <MessageContent from="assistant">
        <ActivityStatus label="Starting the agent" />
      </MessageContent>
    </Message>
  );
}

function ActivityStatus({ label }: { label: string }) {
  return (
    <div className="flex min-h-7 items-center gap-2.5 text-[0.8125rem] leading-snug text-subtle-foreground">
      <Loader className="shrink-0" />
      <span>{label}</span>
    </div>
  );
}

function EveAttribution({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <a
      href="https://vercel.com/eve"
      target="_blank"
      rel="noreferrer"
      className={cn(
        "text-[12px] text-subtle-foreground transition-colors hover:text-foreground",
        className,
      )}
      style={style}
    >
      made with <span className="text-muted-foreground">eve</span>
    </a>
  );
}

function Notice({
  icon: Icon,
  tone,
  children,
}: {
  icon: LucideIcon;
  tone: "amber" | "red";
  children: ReactNode;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "wc-animate-in mx-auto mb-3 flex max-w-md items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[0.8125rem] leading-snug",
        tone === "amber"
          ? "border-amber-500/25 bg-amber-500/10 text-amber-200/90"
          : "border-red-500/25 bg-red-500/10 text-red-200/90",
      )}
    >
      <Icon
        className={cn(
          "size-4 shrink-0",
          tone === "amber" ? "text-amber-400" : "text-red-400",
        )}
      />
      <span>{children}</span>
    </div>
  );
}

function EmptyState({ onSelect }: { onSelect: (suggestion: string) => void }) {
  return (
    <div className="flex min-h-[62dvh] flex-col items-center justify-center py-10 text-center">
      <div className="wc-animate-in relative mb-7">
        <div className="wc-halo" />
        <span className="relative flex size-14 items-center justify-center rounded-2xl border border-border bg-surface text-foreground">
          <BallIcon className="size-7" />
        </span>
      </div>

      <h1
        className="wc-animate-in text-[1.6rem] leading-[1.15] font-semibold tracking-tight text-balance text-foreground sm:text-3xl"
        style={{ animationDelay: "60ms" }}
      >
        Ask anything about the
        <br />
        2026 World Cup
      </h1>

      <p
        className="wc-animate-in mt-3.5 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase"
        style={{ animationDelay: "120ms" }}
      >
        USA · Canada · México — Jun 11 → Jul 19
      </p>

      <div
        className="wc-animate-in mt-9 w-full max-w-lg"
        style={{ animationDelay: "180ms" }}
      >
        <Suggestions className="justify-center">
          {SUGGESTIONS.map((suggestion) => (
            <Suggestion
              key={suggestion}
              suggestion={suggestion}
              onSelect={onSelect}
            />
          ))}
        </Suggestions>
      </div>

      <EveAttribution
        className="wc-animate-in mt-10 font-mono"
        style={{ animationDelay: "240ms" }}
      />
    </div>
  );
}

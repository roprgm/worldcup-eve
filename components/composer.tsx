import type { UseEveAgentStatus } from "eve/react";
import { cn } from "cnfast";
import { ArrowUp, Square } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { EveAttribution } from "@/components/eve";
import { BallIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

const isBusy = (status: UseEveAgentStatus) =>
  status === "submitted" || status === "streaming";

/** Send / stop control. On send it plays a launch animation: the up-arrow
 *  becomes a soccer ball that kicks up and out of the top of the button. */
function SubmitButton({
  status,
  canSend,
  launching,
  onStop,
}: {
  status: UseEveAgentStatus;
  canSend: boolean;
  launching: boolean;
  onStop: () => void;
}) {
  if (isBusy(status) && !launching) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="icon-lg"
        onClick={onStop}
        aria-label="Stop generating"
        className="wc-pop shrink-0 rounded-xl"
      >
        <Square className="size-3.5 fill-current" />
      </Button>
    );
  }

  return (
    <button
      type="submit"
      disabled={!canSend && !launching}
      aria-label="Send message"
      data-launching={launching}
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl transition-all duration-150",
        canSend || launching
          ? "bg-primary text-primary-foreground hover:opacity-90 active:scale-95"
          : "cursor-not-allowed border border-border bg-transparent text-subtle-foreground",
      )}
    >
      <ArrowUp className="wc-send-arrow size-[18px]" />
      <BallIcon className="wc-send-ball absolute inset-0 m-auto size-[17px]" />
    </button>
  );
}

/** The pinned bottom bar: an optional notice, the prompt input, and the footer. */
export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  status,
  notice,
  autoFocus = true,
  placeholder = "Ask about the 2026 World Cup…",
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  status: UseEveAgentStatus;
  notice?: ReactNode;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const launchTimer = useRef<number | null>(null);
  const [launching, setLaunching] = useState(false);
  const canSend = value.trim().length > 0 && !isBusy(status);

  useEffect(
    () => () => {
      if (launchTimer.current) window.clearTimeout(launchTimer.current);
    },
    [],
  );

  // Focus on mount — but only on fine-pointer devices; on touch, focusing pops
  // the keyboard and scrolls the page.
  useEffect(() => {
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

  // Send the message and fire the submit-button launch animation (click or Enter).
  const submit = useCallback(() => {
    if (isBusy(status) || !value.trim()) return;
    if (launchTimer.current) window.clearTimeout(launchTimer.current);
    setLaunching(true);
    launchTimer.current = window.setTimeout(() => setLaunching(false), 500);
    onSubmit();
  }, [status, value, onSubmit]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <div className="shrink-0 border-t border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-3xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.85rem)] sm:px-6">
        {notice}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
          className="flex items-end gap-2 rounded-3xl border border-border bg-surface/70 p-2 pl-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-colors duration-150 focus-within:border-border-strong"
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={placeholder}
            aria-label="Message WC26.chat"
            enterKeyHint="send"
            className="max-h-[168px] min-h-[28px] flex-1 resize-none overflow-y-auto overscroll-contain bg-transparent py-1.5 text-base leading-6 text-foreground field-sizing-content placeholder:text-subtle-foreground focus:outline-none"
          />
          <SubmitButton
            status={status}
            canSend={canSend}
            launching={launching}
            onStop={onStop}
          />
        </form>
        <div className="mt-2.5 flex items-center justify-center gap-1.5 text-center font-mono">
          <p className="text-xs tracking-wide text-subtle-foreground">
            WC26.chat can make mistakes
          </p>
          <span className="text-xs text-subtle-foreground/50">·</span>
          <EveAttribution />
        </div>
      </div>
    </div>
  );
}

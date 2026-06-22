import type { UseEveAgentStatus } from "eve/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { SubmitButton } from "@/components/ai-elements/submit-button";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  status: UseEveAgentStatus;
  placeholder?: string;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  onStop,
  status,
  placeholder = "Ask about the 2026 World Cup…",
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const launchTimer = useRef<number | null>(null);
  const [launching, setLaunching] = useState(false);
  const isBusy = status === "submitted" || status === "streaming";
  const canSend = value.trim().length > 0 && !isBusy;

  // Auto-grow the textarea up to a max height. A zero-width textarea (before flex
  // layout resolves) reports a bogus scrollHeight, so skip measuring until it has width.
  const fit = useCallback(() => {
    const el = textareaRef.current;
    if (!el || el.clientWidth === 0) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, []);

  useLayoutEffect(() => {
    fit();
  }, [value, fit]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    let lastWidth = el.clientWidth;
    fit();
    // Refit when the textarea's width changes (layout settles, viewport resizes).
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== lastWidth) {
        lastWidth = el.clientWidth;
        fit();
      }
    });
    observer.observe(el);
    // Font metrics can shift the height once Geist loads.
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) fit();
    });
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [fit]);

  useEffect(
    () => () => {
      if (launchTimer.current) window.clearTimeout(launchTimer.current);
    },
    [],
  );

  // Send the message and fire the submit-button launch animation (click or Enter).
  const submit = useCallback(() => {
    if (isBusy || !value.trim()) return;
    if (launchTimer.current) window.clearTimeout(launchTimer.current);
    setLaunching(true);
    launchTimer.current = window.setTimeout(() => setLaunching(false), 500);
    onSubmit();
  }, [isBusy, value, onSubmit]);

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
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex items-end gap-2 rounded-[18px] border border-border bg-surface/70 p-2 pl-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.4)] backdrop-blur-xl transition-colors duration-150 focus-within:border-border-strong"
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
        className="max-h-[168px] min-h-[28px] flex-1 resize-none overflow-y-auto bg-transparent py-1.5 text-[0.95rem] leading-6 text-foreground placeholder:text-subtle-foreground focus:outline-none"
      />

      <SubmitButton
        status={status}
        canSend={canSend}
        launching={launching}
        onStop={onStop}
      />
    </form>
  );
}

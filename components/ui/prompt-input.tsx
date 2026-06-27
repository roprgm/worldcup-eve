"use client";

import type { UseEveAgentStatus } from "eve/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { SubmitButton } from "@/components/ui/submit-button";

const MAX_HEIGHT = 168;

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  status: UseEveAgentStatus;
  placeholder?: string;
  autoFocus?: boolean;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  onStop,
  status,
  placeholder = "Ask about the 2026 World Cup…",
  autoFocus = true,
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [launching, setLaunching] = useState(false);
  const isBusy = status === "submitted" || status === "streaming";
  const canSend = value.trim().length > 0 && !isBusy;

  // Auto-grow the textarea up to a cap. A zero-width textarea (before flex
  // layout resolves) reports a bogus scrollHeight, so skip it until it has width.
  const fit = useCallback(() => {
    const el = textareaRef.current;
    if (!el || el.clientWidth === 0) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
  }, []);

  useLayoutEffect(fit, [fit, value]);

  // Refit when the textarea's width changes (layout settles, viewport resizes).
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [fit]);

  // Focus on mount, but only with a fine pointer — on touch this pops the
  // keyboard and scrolls the page.
  useEffect(() => {
    if (autoFocus && window.matchMedia("(pointer: fine)").matches) {
      textareaRef.current?.focus();
    }
  }, [autoFocus]);

  const submit = useCallback(() => {
    if (isBusy || !value.trim()) return;
    setLaunching(true);
    window.setTimeout(() => setLaunching(false), 500);
    onSubmit();
  }, [isBusy, value, onSubmit]);

  return (
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
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            submit();
          }
        }}
        rows={1}
        placeholder={placeholder}
        aria-label="Message WC26.chat"
        enterKeyHint="send"
        className="max-h-[168px] min-h-[28px] flex-1 resize-none overflow-y-auto overscroll-contain bg-transparent py-1.5 text-base leading-6 text-foreground placeholder:text-subtle-foreground focus:outline-none"
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

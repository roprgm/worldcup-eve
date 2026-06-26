import type { UseEveAgentStatus } from "eve/react";
import type { ReactNode } from "react";
import { PromptInput } from "@/components/composer/prompt-input";
import { EveAttribution } from "@/components/eve";

/** The pinned bottom bar: an optional notice, the prompt input, and the footer. */
export function Composer({
  value,
  onChange,
  onSubmit,
  onStop,
  status,
  notice,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  status: UseEveAgentStatus;
  notice?: ReactNode;
  autoFocus?: boolean;
}) {
  return (
    <div className="shrink-0 border-t border-border bg-background/80 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-4xl px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.85rem)] sm:px-6">
        {notice}
        <PromptInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          onStop={onStop}
          status={status}
          autoFocus={autoFocus}
        />
        <div className="mt-2.5 flex flex-col items-center gap-1.5 text-center font-mono">
          <p className="text-[10.5px] tracking-wide text-subtle-foreground">
            WC26.chat can make mistakes — verify important details
          </p>
          <EveAttribution />
        </div>
      </div>
    </div>
  );
}

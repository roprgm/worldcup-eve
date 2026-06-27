import type { UseEveAgentStatus } from "eve/react";
import { cn } from "cnfast";
import { ArrowUp, Square } from "lucide-react";
import { BallIcon } from "@/components/icons";

/** Send / stop control for the prompt input. On send it plays a launch
 *  animation: the up-arrow becomes a soccer ball that kicks up out of the
 *  button (clipped to its bounds via overflow-hidden). */
export function SubmitButton({
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
  const isBusy = status === "submitted" || status === "streaming";

  if (isBusy && !launching) {
    return (
      <button
        type="button"
        onClick={onStop}
        aria-label="Stop generating"
        className="wc-pop flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-foreground transition-colors duration-150 hover:bg-surface-2"
      >
        <Square className="size-3.5 fill-current" />
      </button>
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

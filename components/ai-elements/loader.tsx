import { cn } from "@/lib/utils";

/** Three-dot typing indicator shown while the agent is "thinking". */
export function Loader({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="status"
      aria-label="Agent is typing"
    >
      <span className="wc-loader-dot" />
      <span className="wc-loader-dot" />
      <span className="wc-loader-dot" />
    </div>
  );
}

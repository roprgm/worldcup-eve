import type { ReactNode } from "react";

export default function BracketLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-3 pt-6 pb-6 text-center sm:px-4">
        <h1 className="animate-fade-up text-xl leading-[1.15] font-semibold tracking-tight text-balance text-foreground sm:text-2xl">
          Build your own bracket
        </h1>
        <div className="mt-4 w-full max-w-lg">{children}</div>
      </div>
    </main>
  );
}

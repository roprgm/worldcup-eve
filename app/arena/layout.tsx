import type { ReactNode } from "react";

export default function ArenaLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto flex w-full max-w-2xl flex-col px-3 pt-6 pb-10 sm:px-4">
        {children}
      </div>
    </main>
  );
}

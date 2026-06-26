import { PredictionsSkeleton } from "@/app/predictions/components/predictions-skeleton";

// Instant loading UI: shown the moment you navigate to /predictions, while the
// route's JS chunk downloads and mounts — so a slow connection sees the skeleton
// immediately instead of staying on the previous page. Mirrors the page shell.
export default function Loading() {
  return (
    <main className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-4xl px-3 py-3 sm:px-4">
        <PredictionsSkeleton />
      </div>
    </main>
  );
}

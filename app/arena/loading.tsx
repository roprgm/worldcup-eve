import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the arena's runs and live results are fetched, so the first
 *  navigation paints immediately. */
export default function ArenaLoading() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col items-center gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length placeholder list
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    </div>
  );
}

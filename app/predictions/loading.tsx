// Super-simple, cheap-to-paint loading state shown the instant you navigate to
// /predictions, while the route's JS loads. This is the first of two levels: the
// detailed PredictionsSkeleton takes over once the page mounts, since the data
// is fetched client-side with React Query and needs its own loading state.
const BLOCKS = ["a", "b", "c", "d", "e"];

export default function Loading() {
  return (
    <main className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-4xl space-y-3 px-3 py-3 sm:px-4">
        {BLOCKS.map((id) => (
          <div
            key={id}
            className="h-40 w-full animate-pulse rounded-lg bg-muted/60"
          />
        ))}
      </div>
    </main>
  );
}

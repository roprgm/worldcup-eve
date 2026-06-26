import { TodayMatches } from "@/components/widgets/today-matches";

export default function TodayPage() {
  return (
    <main className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-4xl px-3 py-3 sm:px-4">
        <TodayMatches />
      </div>
    </main>
  );
}

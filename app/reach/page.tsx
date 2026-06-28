import { CardGridFrame } from "@/components/ui/card-grid";
import { Section } from "@/components/ui/section";
import { StageOddsWidget } from "@/components/widgets/stage-odds-widget";

// A single full-width table: every contender's chance to reach each knockout
// round and win the cup, ranked by title odds.
export default function ReachPage() {
  return (
    <main className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-4xl space-y-3 px-3 py-3 sm:px-4">
        <Section title="Road to the final">
          <CardGridFrame>
            <StageOddsWidget />
          </CardGridFrame>
        </Section>
      </div>
    </main>
  );
}

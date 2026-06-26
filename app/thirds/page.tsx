import { CardGrid } from "@/components/ui/card-grid";
import { Section } from "@/components/ui/section";
import {
  ThirdsRankingWidget,
  ThirdsSlotsWidget,
} from "@/components/widgets/thirds-widget";

// Hidden page (not in the nav): the best third-placed teams as things stand and
// the Round-of-32 third-place matchups they imply via FIFA's allocation table.
export default function ThirdsPage() {
  return (
    <main className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-4xl space-y-3 px-3 py-3 sm:px-4">
        <Section title="Best thirds">
          <CardGrid>
            <ThirdsRankingWidget />
            <ThirdsSlotsWidget />
          </CardGrid>
        </Section>
      </div>
    </main>
  );
}

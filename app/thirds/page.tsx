import { CardGrid } from "@/components/ui/card-grid";
import { Section } from "@/components/ui/section";
import {
  ThirdOddsWidget,
  ThirdScenariosCaption,
  ThirdsRankingWidget,
} from "@/components/widgets/thirds-widget";
import { thirdPlaceSlots } from "@/lib/tournament/third-place";

const oddSlots = [...thirdPlaceSlots].sort((a, b) => a.match - b.match);

export default function ThirdsPage() {
  return (
    <main className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-4xl space-y-3 px-3 py-3 sm:px-4">
        <Section title="Best thirds">
          <CardGrid>
            <ThirdsRankingWidget />
          </CardGrid>
        </Section>

        <Section title="Third-place odds">
          <ThirdScenariosCaption />
          <CardGrid>
            {oddSlots.map((slot) => (
              <ThirdOddsWidget key={slot.match} match={slot.match} />
            ))}
          </CardGrid>
        </Section>
      </div>
    </main>
  );
}

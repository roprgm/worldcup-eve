import { CardGrid, CardGridFrame } from "@/components/ui/card-grid";
import { Section } from "@/components/ui/section";
import { PredictionChampionWidget } from "@/components/widgets/prediction-champion-widget";
import { PredictionMatchWidget } from "@/components/widgets/prediction-match-widget";
import { StageOddsWidget } from "@/components/widgets/stage-odds-widget";
import { knockoutMatches, matchByNumber, type Round } from "@/lib/tournament";

/** A round's matches, ordered by match number. */
const roundMatches = (round: Round) =>
  knockoutMatches
    .filter((m) => m.round === round)
    .sort((a, b) => a.number - b.number);

const knockoutSections = [
  { id: "R16", title: "Round of 16", matches: roundMatches("R16") },
  { id: "QF", title: "Quarter-finals", matches: roundMatches("QF") },
  { id: "SF", title: "Semi-finals", matches: roundMatches("SF") },
  {
    id: "FINALS",
    title: "Finals",
    matches: [matchByNumber[103], matchByNumber[104]],
  },
];

// This page owns the whole layout: it lays out the sections and places the
// widgets it shows in a grid. Each widget fetches its own data and renders its
// own skeleton, so the section headers and grid show immediately.
export default function PredictionsPage() {
  return (
    <main className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-3xl space-y-3 px-3 py-3 sm:px-4">
        <Section title="Road to the final">
          <CardGridFrame className="space-y-3">
            <StageOddsWidget />
          </CardGridFrame>
        </Section>

        {knockoutSections.map((section) => (
          <Section key={section.id} title={section.title}>
            <CardGrid>
              {section.matches.map((match) => (
                <PredictionMatchWidget key={match.number} match={match} />
              ))}
            </CardGrid>
          </Section>
        ))}

        <Section title="Champion">
          <PredictionChampionWidget />
        </Section>
      </div>
    </main>
  );
}

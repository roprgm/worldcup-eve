import {
  finalMatch,
  roundLabel,
  roundMatches,
  thirdPlaceMatch,
} from "@/app/predictions/bracket";
import { CardGrid } from "@/components/ui/card-grid";
import { Section } from "@/components/ui/section";
import { PredictionChampionWidget } from "@/components/widgets/prediction-champion-widget";
import { PredictionGroupWidget } from "@/components/widgets/prediction-group-widget";
import { PredictionMatchWidget } from "@/components/widgets/prediction-match-widget";
import { groupLetters } from "@/lib/tournament";

const knockoutSections = [
  { id: "R32", title: roundLabel.R32, matches: roundMatches("R32") },
  { id: "R16", title: roundLabel.R16, matches: roundMatches("R16") },
  { id: "QF", title: roundLabel.QF, matches: roundMatches("QF") },
  { id: "SF", title: roundLabel.SF, matches: roundMatches("SF") },
  { id: "FINALS", title: "Finals", matches: [thirdPlaceMatch, finalMatch] },
];

// This page owns the whole layout: it lays out the sections and places the
// widgets it shows in a grid. Each widget fetches its own data and renders its
// own skeleton, so the section headers and grid show immediately.
export default function PredictionsPage() {
  return (
    <main className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-4xl space-y-3 px-3 py-3 sm:px-4">
        <Section title="Groups">
          <CardGrid>
            {groupLetters.map((letter) => (
              <PredictionGroupWidget key={letter} letter={letter} />
            ))}
          </CardGrid>
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

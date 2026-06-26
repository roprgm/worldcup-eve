import {
  finalMatch,
  roundLabel,
  roundMatches,
  thirdPlaceMatch,
} from "@/app/predictions/bracket";
import { PredictionChampion } from "@/components/widgets/prediction-champion";
import { PredictionGroupStage } from "@/components/widgets/prediction-group-stage";
import { PredictionKnockoutRound } from "@/components/widgets/prediction-knockouts";
import { PredictionSection } from "@/components/widgets/prediction-sections";
import type { KnockoutMatch } from "@/lib/tournament";

const KNOCKOUT_SECTIONS: {
  id: string;
  title: string;
  matches: KnockoutMatch[];
}[] = [
  { id: "R32", title: roundLabel.R32, matches: roundMatches("R32") },
  { id: "R16", title: roundLabel.R16, matches: roundMatches("R16") },
  { id: "QF", title: roundLabel.QF, matches: roundMatches("QF") },
  { id: "SF", title: roundLabel.SF, matches: roundMatches("SF") },
  { id: "FINALS", title: "Finals", matches: [thirdPlaceMatch, finalMatch] },
];

// Static section headers render immediately; each section's content is a
// self-contained widget that fetches its own data and shows its own skeleton.
export default function PredictionsPage() {
  return (
    <main className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-4xl space-y-3 px-3 py-3 sm:px-4">
        <PredictionSection title="Groups">
          <PredictionGroupStage />
        </PredictionSection>

        {KNOCKOUT_SECTIONS.map((section) => (
          <PredictionSection key={section.id} title={section.title}>
            <PredictionKnockoutRound matches={section.matches} />
          </PredictionSection>
        ))}

        <PredictionSection title="Champion">
          <PredictionChampion />
        </PredictionSection>
      </div>
    </main>
  );
}

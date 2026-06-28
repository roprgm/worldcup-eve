import { Section } from "@/components/ui/section";
import { BracketWidget } from "@/components/widgets/bracket-widget";
import { CircularBracketWidget } from "@/components/widgets/circular-bracket-widget";

// Temporary scratch page to try the circular bracket alternative next to the
// current one without touching the live predictions page.
export default function DebugBracketPage() {
  return (
    <main className="flex-1 overflow-y-auto overscroll-contain">
      <div className="mx-auto w-full max-w-4xl space-y-3 px-3 py-3 sm:px-4">
        <Section title="Circular bracket (new)">
          <CircularBracketWidget />
        </Section>
        <Section title="Current bracket">
          <BracketWidget />
        </Section>
      </div>
    </main>
  );
}

import { HomeBracket } from "@/components/widgets/circular-bracket-widget";

// A bare page showing just the home bracket on a dark square. scripts/og-bracket.ts
// screenshots it into the Open Graph / Twitter card image, so the social preview
// is a render of the real widget rather than a separate design.
export default function OgBracketPage() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background">
      <div className="w-[560px] max-w-[90vw]">
        <HomeBracket />
      </div>
    </main>
  );
}

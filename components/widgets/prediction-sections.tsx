"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { CardGrid, CardGridFrame } from "@/components/widgets/card-grid";
import { PredictionMatchCard } from "@/components/widgets/prediction-match-card";

import { cn } from "cnfast";

type Candidate = {
  code: string;
  probability: number;
  name?: string;
};

interface MatchSide {
  label: string;
  candidates: Candidate[];
  showAll?: boolean;
}

interface MatchCardView {
  number: number;
  phaseLabel: string;
  dateTime: string;
  location?: string;
  title?: string;
  home: MatchSide;
  away: MatchSide;
}

interface PredictionSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

interface PredictionMatchGridProps {
  matches: MatchCardView[];
}

export function PredictionSection({
  title,
  children,
  defaultOpen = true,
}: PredictionSectionProps) {
  const contentId = useId();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="space-y-2">
      <CardGridFrame className="sticky top-0 z-20">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((current) => !current)}
          className="relative grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 bg-background/90 pb-2 pt-3 text-xs font-medium tracking-widest text-muted-foreground uppercase backdrop-blur transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="h-px bg-border" />
          <span className="rounded-sm px-2">{title}</span>
          <span className="mr-8 h-px bg-border" />
          <ChevronRight
            aria-hidden
            className={cn(
              "absolute right-1 size-3 transition-transform",
              open && "rotate-90",
            )}
          />
        </button>
      </CardGridFrame>
      {open && <div id={contentId}>{children}</div>}
    </section>
  );
}

export function PredictionMatchGrid({ matches }: PredictionMatchGridProps) {
  return (
    <CardGrid>
      {matches.map((match) => (
        <PredictionMatchCard key={match.number} {...match} />
      ))}
    </CardGrid>
  );
}

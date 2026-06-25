import { cn } from "cnfast";
import { Children, isValidElement, type ReactNode } from "react";

interface CardGridFrameProps {
  children: ReactNode;
  className?: string;
}

interface CardGridProps {
  children: ReactNode;
}

export function CardGridFrame({ children, className }: CardGridFrameProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[1392px]", className)}>
      {children}
    </div>
  );
}

export function CardGrid({ children }: CardGridProps) {
  const items = Children.toArray(children);

  return (
    <CardGridFrame className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,21rem),21rem))] justify-center gap-3">
      {items.map((child, index) => {
        const key =
          isValidElement(child) && child.key != null ? child.key : index;
        return (
          <div key={key} className="w-full min-w-0 shrink-0">
            {child}
          </div>
        );
      })}
    </CardGridFrame>
  );
}

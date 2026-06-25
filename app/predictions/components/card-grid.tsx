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
    <div
      className={cn(
        "mx-auto w-full sm:max-w-[968px] 2xl:max-w-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardGrid({ children }: CardGridProps) {
  const items = Children.toArray(children);

  return (
    <CardGridFrame className="grid grid-cols-1 justify-items-center gap-3 sm:grid-cols-2 2xl:grid-cols-4">
      {items.map((child, index) => {
        const key =
          isValidElement(child) && child.key != null ? child.key : index;
        return (
          <div
            key={key}
            className={cn(
              "w-full max-w-[480px] shrink-0",
              items.length === 2 && index === 0 && "2xl:col-start-2",
            )}
          >
            {child}
          </div>
        );
      })}
    </CardGridFrame>
  );
}

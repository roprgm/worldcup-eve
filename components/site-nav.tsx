"use client";

import { cn } from "cnfast";
import Link from "next/link";
import { usePathname } from "next/navigation";

const baseClass =
  "rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors";

const linkClass = (active: boolean) =>
  cn(
    baseClass,
    "hover:bg-surface",
    active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
  );

/** Cross-page nav shared by every page — minimalist inline links. */
export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-0.5">
      <Link
        href="/predictions"
        className={linkClass(pathname.startsWith("/predictions"))}
      >
        Predictions
      </Link>
      <Link
        href="/bracket"
        className={linkClass(pathname.startsWith("/bracket"))}
      >
        Bracket
      </Link>
    </nav>
  );
}

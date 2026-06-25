import type { ReactNode } from "react";

import { Providers } from "@/app/predictions/providers";

// Reuse the predictions react-query provider so /today polls the same
// /predictions/api/* endpoints, scoped to this route.
export default function TodayLayout({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}

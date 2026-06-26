import type { ReactNode } from "react";

import { Providers } from "@/app/predictions/providers";

// Reuse the predictions' react-query provider so the widgets here share the same
// polled results query. Unlinked from the nav — reachable only by URL.
export default function ThirdsLayout({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}

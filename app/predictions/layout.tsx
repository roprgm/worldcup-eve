import type { ReactNode } from "react";

import { Providers } from "@/app/predictions/providers";

// Scope the react-query provider to the predictions route so the rest of the app
// (the chat) is untouched.
export default function PredictionsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <Providers>{children}</Providers>;
}

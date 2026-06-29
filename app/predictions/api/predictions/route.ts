import { NextResponse } from "next/server";

import { getPredictions } from "@/lib/predictions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getPredictions());
  } catch {
    return NextResponse.json(
      { error: "predictions unavailable" },
      { status: 502 },
    );
  }
}

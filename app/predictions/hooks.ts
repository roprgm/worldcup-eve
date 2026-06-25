"use client";

import { useQuery } from "@tanstack/react-query";

import type { Predictions } from "@/lib/predictions";
import type { Results } from "@/lib/results";

// Polls a JSON endpoint on a fixed interval. react-query keeps the last good
// payload across errors and dedups concurrent users.
function usePolledEndpoint<T>(
  key: string,
  url: string,
  intervalMs: number,
): T | null {
  const { data } = useQuery<T>({
    queryKey: [key],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${key} unavailable`);
      return res.json();
    },
    refetchInterval: intervalMs,
  });
  return data ?? null;
}

export const usePredictions = () =>
  usePolledEndpoint<Predictions>(
    "predictions",
    "/predictions/api/predictions",
    15_000,
  );

export const useResults = () =>
  usePolledEndpoint<Results>("results", "/predictions/api/results", 10_000);

"use client";

import { useQuery } from "@tanstack/react-query";

import type { Predictions } from "@/lib/predictions";
import type { Results } from "@/lib/results";

// Shared polled queries behind the widgets. A single query key per endpoint, so
// every widget that reads the same data dedups onto one request. Pass `select`
// to derive just the slice a widget needs (recomputed only when the data does).

async function fetchJson<T>(url: string, key: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${key} unavailable`);
  return res.json();
}

export function usePredictions<T = Predictions>(
  select?: (data: Predictions) => T,
): T | undefined {
  return useQuery({
    queryKey: ["predictions"],
    queryFn: () =>
      fetchJson<Predictions>("/predictions/api/predictions", "predictions"),
    refetchInterval: 15_000,
    select,
  }).data;
}

export function useResults<T = Results>(
  select?: (data: Results) => T,
): T | undefined {
  return useQuery({
    queryKey: ["results"],
    queryFn: () => fetchJson<Results>("/predictions/api/results", "results"),
    refetchInterval: 10_000,
    select,
  }).data;
}

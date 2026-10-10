import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const metricTypes = [
  "weight",
  "waist",
  "chest",
  "hips",
  "arm",
  "thigh",
  "calf",
  "neck",
  "bodyfat",
] as const;
export type MetricType = (typeof metricTypes)[number];

export type BodyMetric = {
  id: number;
  userId: number;
  date: string;
  type: MetricType;
  value: number;
};

export type WaterEntry = { id: number; date: string; amountMl: number };

export function useMetrics(type?: MetricType) {
  return useQuery({
    queryKey: ["metrics", type ?? "all"],
    queryFn: () =>
      api.get<{ metrics: BodyMetric[] }>(`/api/metrics${type ? `?type=${type}` : ""}`),
  });
}

export function useMetricMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["metrics"] });
  const add = useMutation({
    mutationFn: (input: { date: string; type: MetricType; value: number }) =>
      api.post<{ metric: BodyMetric }>("/api/metrics", input),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete<{ ok: boolean }>(`/api/metrics/${id}`),
    onSuccess: invalidate,
  });
  return { add, remove };
}

export function useWaterDay(date: string) {
  return useQuery({
    queryKey: ["water", "day", date],
    queryFn: () =>
      api.get<{ date: string; entries: WaterEntry[]; totalMl: number }>(
        `/api/water/day/${date}`,
      ),
  });
}

export function useWaterHistory(days: number) {
  return useQuery({
    queryKey: ["water", "history", days],
    queryFn: () =>
      api.get<{ days: { date: string; totalMl: number }[] }>(
        `/api/water/history?days=${days}`,
      ),
  });
}

export function useWaterMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["water"] });
  const add = useMutation({
    mutationFn: (input: { date: string; amountMl: number }) =>
      api.post<{ entry: WaterEntry }>("/api/water", input),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete<{ ok: boolean }>(`/api/water/${id}`),
    onSuccess: invalidate,
  });
  return { add, remove };
}

export function useCaloriesHistory(days: number) {
  return useQuery({
    queryKey: ["stats", "calories", days],
    queryFn: () =>
      api.get<{ days: { date: string; calories: number }[] }>(
        `/api/stats/calories?days=${days}`,
      ),
  });
}

export function useVolumeHistory(weeks: number) {
  return useQuery({
    queryKey: ["stats", "volume", weeks],
    queryFn: () =>
      api.get<{
        weeks: { weekStart: string; total: number; byMuscle: Record<string, number> }[];
      }>(`/api/stats/volume?weeks=${weeks}`),
  });
}

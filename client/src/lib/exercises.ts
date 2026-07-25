import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type LogType = "strength" | "bodyweight" | "cardio" | "duration";

export type Exercise = {
  id: number;
  externalId: string | null;
  ownerId: number | null;
  name: string;
  logType: LogType;
  datasetCategory: string | null;
  level: string | null;
  mechanic: string | null;
  force: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
  images: string[];
  isDeleted: boolean;
};

export type ExerciseFilters = {
  search?: string;
  muscle?: string;
  equipment?: string;
  logType?: LogType;
  page?: number;
  pageSize?: number;
};

export const logTypeLabels: Record<LogType, string> = {
  strength: "Strength",
  bodyweight: "Bodyweight",
  cardio: "Cardio",
  duration: "Duration",
};

export function exerciseImageUrl(path: string): string {
  return `/exercise-images/${path}`;
}

export function useExercises(filters: ExerciseFilters) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  return useQuery({
    queryKey: ["exercises", params.toString()],
    queryFn: () =>
      api.get<{ exercises: Exercise[]; total: number; page: number; pageSize: number }>(
        `/api/exercises?${params.toString()}`,
      ),
    placeholderData: (prev) => prev,
  });
}

export function useExerciseMeta() {
  return useQuery({
    queryKey: ["exercises", "meta"],
    queryFn: () => api.get<{ equipment: string[]; muscles: string[] }>("/api/exercises/meta"),
    staleTime: 60 * 60 * 1000,
  });
}

export function useExercise(id: number) {
  return useQuery({
    queryKey: ["exercises", "detail", id],
    queryFn: () => api.get<{ exercise: Exercise }>(`/api/exercises/${id}`),
    enabled: Number.isInteger(id) && id > 0,
  });
}

export type CustomExerciseInput = {
  name: string;
  logType: LogType;
  equipment?: string | null;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  instructions?: string[];
};

export function useExerciseMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["exercises"] });
  const create = useMutation({
    mutationFn: (input: CustomExerciseInput) =>
      api.post<{ exercise: Exercise }>("/api/exercises", input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, ...input }: CustomExerciseInput & { id: number }) =>
      api.patch<{ exercise: Exercise }>(`/api/exercises/${id}`, input),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete<{ ok: boolean }>(`/api/exercises/${id}`),
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

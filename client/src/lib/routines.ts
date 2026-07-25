import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { LogType } from "./exercises";

export type RoutineExerciseInput = {
  exerciseId: number;
  targetSets?: number | null;
  targetReps?: number | null;
  targetWeight?: number | null;
  targetDurationSec?: number | null;
  targetDistance?: number | null;
  notes?: string | null;
};

export type RoutineExercise = RoutineExerciseInput & {
  id: number;
  routineId: number;
  position: number;
  exercise: { id: number; name: string; logType: LogType; images: string[] };
};

export type Routine = {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  exercises: RoutineExercise[];
};

export type RoutineInput = {
  name: string;
  description?: string | null;
  isArchived?: boolean;
  exercises: RoutineExerciseInput[];
};

export function useRoutines() {
  return useQuery({
    queryKey: ["routines"],
    queryFn: () => api.get<{ routines: Routine[] }>("/api/routines"),
  });
}

export function useRoutine(id: number) {
  return useQuery({
    queryKey: ["routines", id],
    queryFn: () => api.get<{ routine: Routine }>(`/api/routines/${id}`),
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useRoutineMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["routines"] });
  const create = useMutation({
    mutationFn: (input: RoutineInput) =>
      api.post<{ routine: Routine }>("/api/routines", input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, ...input }: RoutineInput & { id: number }) =>
      api.put<{ routine: Routine }>(`/api/routines/${id}`, input),
    onSuccess: invalidate,
  });
  const duplicate = useMutation({
    mutationFn: (id: number) =>
      api.post<{ routine: Routine }>(`/api/routines/${id}/duplicate`),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete<{ ok: boolean }>(`/api/routines/${id}`),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
  });
  return { create, update, duplicate, remove };
}

export type ScheduleEntry = {
  id: number;
  userId: number;
  routineId: number;
  weekday: number | null;
  date: string | null;
};

export function useSchedule() {
  return useQuery({
    queryKey: ["schedule"],
    queryFn: () => api.get<{ entries: ScheduleEntry[] }>("/api/schedule"),
  });
}

export function useScheduleMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["schedule"] });
  const create = useMutation({
    mutationFn: (input: { routineId: number; weekday?: number; date?: string }) =>
      api.post<{ entry: ScheduleEntry }>("/api/schedule", input),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete<{ ok: boolean }>(`/api/schedule/${id}`),
    onSuccess: invalidate,
  });
  return { create, remove };
}

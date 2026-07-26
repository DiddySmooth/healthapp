import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { LogType } from "./exercises";

export type WorkoutSet = {
  id: number;
  sessionExerciseId: number;
  position: number;
  weight: number | null;
  reps: number | null;
  durationSec: number | null;
  distance: number | null;
  isWarmup: boolean;
  completed: boolean;
};

export type SessionExercise = {
  id: number;
  sessionId: number;
  exerciseId: number;
  position: number;
  notes: string | null;
  exercise: { id: number; name: string; logType: LogType; images: string[] };
  sets: WorkoutSet[];
  previous: WorkoutSet[];
};

export type Session = {
  id: number;
  userId: number;
  routineId: number | null;
  routineName: string | null;
  startedAt: string;
  finishedAt: string | null;
  notes: string | null;
  exercises: SessionExercise[];
};

export type SessionSummary = {
  id: number;
  routineName: string | null;
  startedAt: string;
  finishedAt: string | null;
  notes: string | null;
  exerciseCount: number;
  setCount: number;
  volume: number;
};

export function useActiveSession() {
  return useQuery({
    queryKey: ["sessions", "active"],
    queryFn: () => api.get<{ session: Session | null }>("/api/sessions/active"),
  });
}

export function useSession(id: number) {
  return useQuery({
    queryKey: ["sessions", "detail", id],
    queryFn: () => api.get<{ session: Session }>(`/api/sessions/${id}`),
    enabled: Number.isInteger(id) && id > 0,
  });
}

export function useSessionHistory(page = 1) {
  return useQuery({
    queryKey: ["sessions", "history", page],
    queryFn: () => api.get<{ sessions: SessionSummary[]; page: number }>(`/api/sessions?page=${page}`),
  });
}

export function useSessionMutations(sessionId?: number) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["sessions"] });
  };

  const start = useMutation({
    mutationFn: (input: { routineId?: number }) =>
      api.post<{ session: Session }>("/api/sessions", input),
    onSuccess: invalidate,
  });
  const patchSession = useMutation({
    mutationFn: (input: {
      id: number;
      notes?: string | null;
      finished?: boolean;
    }) => {
      const { id, ...body } = input;
      return api.patch<{ session: Session }>(`/api/sessions/${id}`, body);
    },
    onSuccess: invalidate,
  });
  const removeSession = useMutation({
    mutationFn: (id: number) => api.delete<{ ok: boolean }>(`/api/sessions/${id}`),
    onSuccess: invalidate,
  });
  const addExercise = useMutation({
    mutationFn: (input: { exerciseId: number }) =>
      api.post<{ session: Session }>(`/api/sessions/${sessionId}/exercises`, input),
    onSuccess: invalidate,
  });
  const removeExercise = useMutation({
    mutationFn: (seId: number) =>
      api.delete<{ session: Session }>(`/api/sessions/${sessionId}/exercises/${seId}`),
    onSuccess: invalidate,
  });
  const addSet = useMutation({
    mutationFn: (seId: number) =>
      api.post<{ set: WorkoutSet }>(`/api/sessions/${sessionId}/exercises/${seId}/sets`),
    onSuccess: invalidate,
  });
  const patchSet = useMutation({
    mutationFn: (input: {
      seId: number;
      setId: number;
      patch: Partial<Omit<WorkoutSet, "id" | "sessionExerciseId" | "position">>;
    }) =>
      api.patch<{ set: WorkoutSet }>(
        `/api/sessions/${sessionId}/exercises/${input.seId}/sets/${input.setId}`,
        input.patch,
      ),
    onSuccess: invalidate,
  });
  const removeSet = useMutation({
    mutationFn: (input: { seId: number; setId: number }) =>
      api.delete<{ ok: boolean }>(
        `/api/sessions/${sessionId}/exercises/${input.seId}/sets/${input.setId}`,
      ),
    onSuccess: invalidate,
  });

  return {
    start,
    patchSession,
    removeSession,
    addExercise,
    removeExercise,
    addSet,
    patchSet,
    removeSet,
  };
}

export function formatDuration(startISO: string, endISO: string | null): string {
  const ms = (endISO ? new Date(endISO).getTime() : Date.now()) - new Date(startISO).getTime();
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function sessionVolume(session: Session): number {
  return session.exercises
    .flatMap((se) => se.sets)
    .filter((s) => s.completed)
    .reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0);
}

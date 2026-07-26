import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card } from "../components/ui";
import { api } from "../lib/api";
import {
  exerciseImageUrl,
  logTypeLabels,
  useExercise,
  useExerciseMutations,
} from "../lib/exercises";
import type { WorkoutSet } from "../lib/sessions";

type PRs = {
  maxWeight: { weight: number; reps: number; date: string } | null;
  best1RM: { value: number; weight: number; reps: number; date: string } | null;
  maxReps: { reps: number; weight: number | null; date: string } | null;
  maxDurationSec: { durationSec: number; date: string } | null;
  maxDistance: { distance: number; date: string } | null;
};

type HistoryEntry = { sessionId: number; date: string; sets: WorkoutSet[] };

function useExerciseStats(exerciseId: number) {
  return useQuery({
    queryKey: ["stats", "exercise", exerciseId],
    queryFn: () =>
      api.get<{ history: HistoryEntry[]; prs: PRs }>(`/api/stats/exercise/${exerciseId}`),
    enabled: exerciseId > 0,
  });
}

function setLabel(s: WorkoutSet): string {
  if (s.weight != null && s.weight > 0) return `${s.weight}×${s.reps ?? 0}`;
  if (s.reps != null && s.reps > 0) return `${s.reps} reps`;
  const parts: string[] = [];
  if (s.durationSec != null) parts.push(`${Math.round(s.durationSec / 60)}m`);
  if (s.distance != null) parts.push(String(s.distance));
  return parts.join(" · ") || "—";
}

function StatsSection({ exerciseId }: { exerciseId: number }) {
  const { data } = useExerciseStats(exerciseId);
  if (!data || data.history.length === 0) return null;
  const { prs, history } = data;
  const prItems: { label: string; value: string }[] = [];
  if (prs.maxWeight)
    prItems.push({
      label: "Heaviest set",
      value: `${prs.maxWeight.weight}×${prs.maxWeight.reps}`,
    });
  if (prs.best1RM) prItems.push({ label: "Best est. 1RM", value: String(prs.best1RM.value) });
  if (prs.maxReps) prItems.push({ label: "Most reps", value: String(prs.maxReps.reps) });
  if (prs.maxDurationSec)
    prItems.push({
      label: "Longest",
      value: `${Math.round(prs.maxDurationSec.durationSec / 60)} min`,
    });
  if (prs.maxDistance)
    prItems.push({ label: "Farthest", value: String(prs.maxDistance.distance) });

  return (
    <>
      {prItems.length > 0 && (
        <Card title="Personal records" className="mt-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {prItems.map((pr) => (
              <div key={pr.label} className="rounded-lg bg-surface-2/50 p-3 text-center">
                <p className="text-lg font-bold text-accent">{pr.value}</p>
                <p className="text-xs text-muted">{pr.label}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
      <Card title="Recent history" className="mt-4">
        <ul className="divide-y divide-border">
          {history.slice(0, 8).map((h) => (
            <li key={h.sessionId} className="flex items-baseline gap-3 py-2">
              <Link
                to={`/workouts/session/${h.sessionId}`}
                className="shrink-0 text-sm text-muted hover:text-accent"
              >
                {new Date(h.date).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </Link>
              <span className="flex flex-wrap gap-1.5">
                {h.sets.map((s) => (
                  <span
                    key={s.id}
                    className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-fg"
                  >
                    {setLabel(s)}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">
      {children}
    </span>
  );
}

export default function ExerciseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useExercise(Number(id));
  const { remove } = useExerciseMutations();
  const [imageIndex, setImageIndex] = useState(0);

  if (isLoading) return <p className="py-12 text-center text-muted">Loading…</p>;
  if (isError || !data) {
    return <p className="py-12 text-center text-danger">Exercise not found.</p>;
  }
  const ex = data.exercise;
  const isCustom = ex.ownerId != null;

  function confirmDelete() {
    if (window.confirm(`Delete "${ex.name}"? Past workout history keeps it.`)) {
      remove.mutate(ex.id, { onSuccess: () => navigate("/workouts/exercises") });
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/workouts/exercises" className="text-sm text-muted hover:text-fg">
        ← Back to exercises
      </Link>

      <div className="mt-2 mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{ex.name}</h1>
        {isCustom && (
          <span className="rounded bg-accent-2/20 px-1.5 py-0.5 text-xs text-accent-2">
            custom
          </span>
        )}
        {isCustom && (
          <span className="ml-auto flex gap-2">
            <Link to={`/workouts/exercises/${ex.id}/edit`}>
              <Button variant="ghost">Edit</Button>
            </Link>
            <Button variant="danger" onClick={confirmDelete}>
              Delete
            </Button>
          </span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge>{logTypeLabels[ex.logType]}</Badge>
        {ex.equipment && <Badge>{ex.equipment}</Badge>}
        {ex.level && <Badge>{ex.level}</Badge>}
        {ex.mechanic && <Badge>{ex.mechanic}</Badge>}
      </div>

      {ex.images.length > 0 && (
        <div className="mb-4">
          <img
            src={exerciseImageUrl(ex.images[imageIndex] ?? ex.images[0]!)}
            alt={ex.name}
            className="w-full rounded-xl"
          />
          {ex.images.length > 1 && (
            <div className="mt-2 flex justify-center gap-2">
              {ex.images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setImageIndex(i)}
                  className={`h-2.5 w-2.5 rounded-full ${
                    i === imageIndex ? "bg-accent" : "bg-surface-2"
                  }`}
                  aria-label={`Image ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card title="Primary muscles">
          <p className="text-sm text-muted">
            {ex.primaryMuscles.join(", ") || "—"}
          </p>
        </Card>
        <Card title="Secondary muscles">
          <p className="text-sm text-muted">
            {ex.secondaryMuscles.join(", ") || "—"}
          </p>
        </Card>
      </div>

      {ex.instructions.length > 0 && (
        <Card title="Instructions">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted">
            {ex.instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </Card>
      )}

      <StatsSection exerciseId={ex.id} />
    </div>
  );
}

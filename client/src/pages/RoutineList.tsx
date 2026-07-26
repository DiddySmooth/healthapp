import { Link, useNavigate } from "react-router-dom";
import { Button, Card } from "../components/ui";
import { ApiError } from "../lib/api";
import { useRoutineMutations, useRoutines, type Routine } from "../lib/routines";
import { useActiveSession, useSessionMutations } from "../lib/sessions";

function RoutineCard({ routine }: { routine: Routine }) {
  const { duplicate, remove } = useRoutineMutations();
  const { start } = useSessionMutations();
  const { data: activeData } = useActiveSession();
  const navigate = useNavigate();

  function startWorkout() {
    const active = activeData?.session;
    if (active) {
      navigate(`/workouts/session/${active.id}`);
      return;
    }
    start.mutate(
      { routineId: routine.id },
      {
        onSuccess: (data) => navigate(`/workouts/session/${data.session.id}`),
        onError: (e) => {
          if (e instanceof ApiError && e.code === "ACTIVE_SESSION") {
            window.alert("A workout is already in progress — resume it first.");
          }
        },
      },
    );
  }

  function confirmDelete() {
    if (window.confirm(`Delete routine "${routine.name}"? This also removes it from your schedule.`)) {
      remove.mutate(routine.id);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold">{routine.name}</h3>
          {routine.description && (
            <p className="mt-0.5 text-sm text-muted">{routine.description}</p>
          )}
          <p className="mt-1 truncate text-xs text-faint">
            {routine.exercises.length} exercise{routine.exercises.length === 1 ? "" : "s"}
            {routine.exercises.length > 0 &&
              ` · ${routine.exercises.map((e) => e.exercise.name).slice(0, 3).join(", ")}${
                routine.exercises.length > 3 ? "…" : ""
              }`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={startWorkout} disabled={start.isPending}>
            Start
          </Button>
          <Button variant="ghost" onClick={() => navigate(`/workouts/routines/${routine.id}/edit`)}>
            Edit
          </Button>
          <Button variant="ghost" onClick={() => duplicate.mutate(routine.id)}>
            Duplicate
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function RoutineList() {
  const { data, isLoading } = useRoutines();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Routines</h1>
        <Link to="/workouts/routines/new">
          <Button>New routine</Button>
        </Link>
      </div>
      {isLoading ? (
        <p className="py-12 text-center text-muted">Loading…</p>
      ) : data?.routines.length === 0 ? (
        <Card>
          <p className="text-center text-muted">
            No routines yet. Build one to plan your workouts — e.g. “Push Day A”.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {data?.routines.map((r) => <RoutineCard key={r.id} routine={r} />)}
        </div>
      )}
    </div>
  );
}

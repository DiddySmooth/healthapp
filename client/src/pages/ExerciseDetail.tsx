import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card } from "../components/ui";
import {
  exerciseImageUrl,
  logTypeLabels,
  useExercise,
  useExerciseMutations,
} from "../lib/exercises";

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
      remove.mutate(ex.id, { onSuccess: () => navigate("/workouts") });
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/workouts" className="text-sm text-muted hover:text-fg">
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

      {/* Personal history and PRs land here in Phase 5. */}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Input, Select } from "../components/ui";
import {
  exerciseImageUrl,
  logTypeLabels,
  useExerciseMeta,
  useExercises,
  type Exercise,
  type LogType,
} from "../lib/exercises";

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const img = exercise.images[0];
  return (
    <Link
      to={`/workouts/exercises/${exercise.id}`}
      className="group overflow-hidden rounded-xl bg-surface transition-transform hover:-translate-y-0.5"
    >
      <div className="aspect-[4/3] w-full bg-surface-2">
        {img ? (
          <img
            src={exerciseImageUrl(img)}
            alt={exercise.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl text-faint">
            🏋️
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-semibold group-hover:text-accent">
          {exercise.name}
          {exercise.ownerId != null && (
            <span className="ml-1 rounded bg-accent-2/20 px-1 text-xs text-accent-2">
              custom
            </span>
          )}
        </h3>
        <p className="truncate text-xs text-muted">
          {exercise.primaryMuscles.join(", ") || logTypeLabels[exercise.logType]}
        </p>
      </div>
    </Link>
  );
}

export default function ExerciseLibrary() {
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");
  const meta = useExerciseMeta();

  const filters = {
    search: params.get("search") ?? undefined,
    muscle: params.get("muscle") ?? undefined,
    equipment: params.get("equipment") ?? undefined,
    logType: (params.get("logType") as LogType | null) ?? undefined,
    page: Number(params.get("page") ?? 1),
    pageSize: 24,
  };
  const list = useExercises(filters);

  // Debounce typed search into the URL.
  useEffect(() => {
    const t = setTimeout(() => {
      const search = searchInput.trim();
      if ((params.get("search") ?? "") !== search) {
        setParam("search", search);
      }
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next, { replace: true });
  }

  const totalPages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 24));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Exercises</h1>
        <Link to="/workouts/exercises/new">
          <Button>New exercise</Button>
        </Link>
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        <Input
          placeholder="Search exercises…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select
          value={filters.muscle ?? ""}
          onChange={(e) => setParam("muscle", e.target.value)}
        >
          <option value="">All muscles</option>
          {meta.data?.muscles.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
        <Select
          value={filters.equipment ?? ""}
          onChange={(e) => setParam("equipment", e.target.value)}
        >
          <option value="">All equipment</option>
          {meta.data?.equipment.map((eq) => (
            <option key={eq} value={eq}>
              {eq}
            </option>
          ))}
        </Select>
        <Select
          value={filters.logType ?? ""}
          onChange={(e) => setParam("logType", e.target.value)}
        >
          <option value="">All types</option>
          {Object.entries(logTypeLabels).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </Select>
      </div>

      {list.isLoading ? (
        <p className="py-12 text-center text-muted">Loading…</p>
      ) : list.data?.exercises.length === 0 ? (
        <p className="py-12 text-center text-muted">No exercises match those filters.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {list.data?.exercises.map((ex) => (
              <ExerciseCard key={ex.id} exercise={ex} />
            ))}
          </div>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Button
              variant="ghost"
              disabled={filters.page <= 1}
              onClick={() => setParam("page", String(filters.page - 1))}
            >
              Previous
            </Button>
            <span className="text-sm text-muted">
              Page {filters.page} of {totalPages} · {list.data?.total} exercises
            </span>
            <Button
              variant="ghost"
              disabled={filters.page >= totalPages}
              onClick={() => setParam("page", String(filters.page + 1))}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

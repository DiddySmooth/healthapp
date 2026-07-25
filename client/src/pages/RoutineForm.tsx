import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, ErrorText, Field, Input } from "../components/ui";
import { logTypeLabels, useExercises, type Exercise, type LogType } from "../lib/exercises";
import {
  useRoutine,
  useRoutineMutations,
  type RoutineExerciseInput,
} from "../lib/routines";

type Row = RoutineExerciseInput & {
  exercise: { id: number; name: string; logType: LogType };
};

function numOrNull(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function TargetInput({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  step?: string;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-muted">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={step ?? "1"}
        value={value ?? ""}
        onChange={(e) => onChange(numOrNull(e.target.value))}
        className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-sm text-fg focus:border-accent focus:outline-none"
      />
    </label>
  );
}

function ExercisePicker({ onPick }: { onPick: (ex: Exercise) => void }) {
  const [search, setSearch] = useState("");
  const results = useExercises({ search, pageSize: 8 });
  return (
    <div className="rounded-lg border border-border p-3">
      <Input
        placeholder="Search exercises to add…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      {search.trim() !== "" && (
        <ul className="mt-2 max-h-56 divide-y divide-border overflow-y-auto">
          {results.data?.exercises.map((ex) => (
            <li key={ex.id}>
              <button
                type="button"
                onClick={() => onPick(ex)}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-surface-2"
              >
                <span className="flex-1 truncate">{ex.name}</span>
                <span className="text-xs text-faint">{logTypeLabels[ex.logType]}</span>
              </button>
            </li>
          ))}
          {results.data?.exercises.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-faint">No matches.</li>
          )}
        </ul>
      )}
    </div>
  );
}

function RowEditor({
  row,
  index,
  count,
  onChange,
  onMove,
  onRemove,
}: {
  row: Row;
  index: number;
  count: number;
  onChange: (next: Row) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const t = row.exercise.logType;
  return (
    <div className="rounded-lg bg-surface-2/50 p-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{row.exercise.name}</span>
        <span className="text-xs text-faint">{logTypeLabels[t]}</span>
        <span className="ml-auto flex gap-1">
          <Button variant="ghost" type="button" disabled={index === 0} onClick={() => onMove(-1)} className="px-2 py-1">
            ↑
          </Button>
          <Button
            variant="ghost"
            type="button"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
            className="px-2 py-1"
          >
            ↓
          </Button>
          <Button variant="danger" type="button" onClick={onRemove} className="px-2 py-1">
            ✕
          </Button>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3">
        {(t === "strength" || t === "bodyweight") && (
          <>
            <TargetInput
              label="Sets"
              value={row.targetSets}
              onChange={(v) => onChange({ ...row, targetSets: v })}
            />
            <TargetInput
              label="Reps"
              value={row.targetReps}
              onChange={(v) => onChange({ ...row, targetReps: v })}
            />
          </>
        )}
        {t === "strength" && (
          <TargetInput
            label="Weight"
            step="0.5"
            value={row.targetWeight}
            onChange={(v) => onChange({ ...row, targetWeight: v })}
          />
        )}
        {t === "bodyweight" && (
          <TargetInput
            label="+Weight"
            step="0.5"
            value={row.targetWeight}
            onChange={(v) => onChange({ ...row, targetWeight: v })}
          />
        )}
        {(t === "cardio" || t === "duration") && (
          <TargetInput
            label="Minutes"
            value={row.targetDurationSec != null ? Math.round(row.targetDurationSec / 60) : null}
            onChange={(v) => onChange({ ...row, targetDurationSec: v != null ? v * 60 : null })}
          />
        )}
        {t === "cardio" && (
          <TargetInput
            label="Distance"
            step="0.1"
            value={row.targetDistance}
            onChange={(v) => onChange({ ...row, targetDistance: v })}
          />
        )}
        <input
          placeholder="Notes"
          value={row.notes ?? ""}
          onChange={(e) => onChange({ ...row, notes: e.target.value || null })}
          className="min-w-32 flex-1 rounded-md border border-border bg-surface px-2 py-1 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
        />
      </div>
    </div>
  );
}

export default function RoutineForm() {
  const { id } = useParams();
  const editing = id != null;
  const navigate = useNavigate();
  const existing = useRoutine(editing ? Number(id) : -1);
  const { create, update } = useRoutineMutations();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [initialized, setInitialized] = useState(!editing);

  const routine = existing.data?.routine;
  if (editing && routine && !initialized) {
    setName(routine.name);
    setDescription(routine.description ?? "");
    setRows(
      routine.exercises.map((re) => ({
        exerciseId: re.exerciseId,
        targetSets: re.targetSets,
        targetReps: re.targetReps,
        targetWeight: re.targetWeight,
        targetDurationSec: re.targetDurationSec,
        targetDistance: re.targetDistance,
        notes: re.notes,
        exercise: {
          id: re.exercise.id,
          name: re.exercise.name,
          logType: re.exercise.logType,
        },
      })),
    );
    setInitialized(true);
  }

  if (editing && existing.isLoading) {
    return <p className="py-12 text-center text-muted">Loading…</p>;
  }

  const mutation = editing ? update : create;

  function submit(e: FormEvent) {
    e.preventDefault();
    const input = {
      name: name.trim(),
      description: description.trim() || null,
      exercises: rows.map(({ exercise: _ex, ...rest }) => rest),
    };
    const opts = { onSuccess: () => navigate("/workouts/routines") };
    if (editing) update.mutate({ id: Number(id), ...input }, opts);
    else create.mutate(input, opts);
  }

  function addExercise(ex: Exercise) {
    const defaults: Partial<Row> =
      ex.logType === "strength" || ex.logType === "bodyweight"
        ? { targetSets: 3, targetReps: 10 }
        : {};
    setRows([
      ...rows,
      {
        exerciseId: ex.id,
        ...defaults,
        exercise: { id: ex.id, name: ex.name, logType: ex.logType },
      },
    ]);
    setShowPicker(false);
  }

  function moveRow(index: number, dir: -1 | 1) {
    const next = [...rows];
    const [row] = next.splice(index, 1);
    next.splice(index + dir, 0, row!);
    setRows(next);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/workouts/routines" className="text-sm text-muted hover:text-fg">
        ← Back to routines
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-bold">
        {editing ? "Edit routine" : "New routine"}
      </h1>
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Push Day A"
              required
            />
          </Field>
          <Field label="Description (optional)">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>

          <div>
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
              Exercises
            </span>
            <div className="flex flex-col gap-2">
              {rows.map((row, i) => (
                <RowEditor
                  key={`${row.exerciseId}-${i}`}
                  row={row}
                  index={i}
                  count={rows.length}
                  onChange={(next) => setRows(rows.map((r, j) => (j === i ? next : r)))}
                  onMove={(dir) => moveRow(i, dir)}
                  onRemove={() => setRows(rows.filter((_, j) => j !== i))}
                />
              ))}
              {showPicker ? (
                <ExercisePicker onPick={addExercise} />
              ) : (
                <Button type="button" variant="ghost" onClick={() => setShowPicker(true)}>
                  + Add exercise
                </Button>
              )}
            </div>
          </div>

          <ErrorText>{mutation.error?.message}</ErrorText>
          <div className="flex gap-3">
            <Button type="submit" disabled={mutation.isPending || rows.length === 0}>
              {editing ? "Save changes" : "Create routine"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

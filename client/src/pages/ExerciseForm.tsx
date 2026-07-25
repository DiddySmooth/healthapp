import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button, Card, ErrorText, Field, Input, Select } from "../components/ui";
import {
  logTypeLabels,
  useExercise,
  useExerciseMeta,
  useExerciseMutations,
  type LogType,
} from "../lib/exercises";

function MusclePicker({
  label,
  all,
  selected,
  onChange,
}: {
  label: string;
  all: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {all.map((m) => {
          const active = selected.includes(m);
          return (
            <button
              type="button"
              key={m}
              onClick={() =>
                onChange(active ? selected.filter((x) => x !== m) : [...selected, m])
              }
              className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
                active ? "bg-accent text-bg font-semibold" : "bg-surface-2 text-muted"
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function ExerciseForm() {
  const { id } = useParams();
  const editing = id != null;
  const navigate = useNavigate();
  const meta = useExerciseMeta();
  const existing = useExercise(editing ? Number(id) : -1);
  const { create, update } = useExerciseMutations();

  const ex = editing ? existing.data?.exercise : undefined;
  const [name, setName] = useState(ex?.name ?? "");
  const [logType, setLogType] = useState<LogType>(ex?.logType ?? "strength");
  const [equipment, setEquipment] = useState(ex?.equipment ?? "");
  const [primary, setPrimary] = useState<string[]>(ex?.primaryMuscles ?? []);
  const [secondary, setSecondary] = useState<string[]>(ex?.secondaryMuscles ?? []);
  const [instructions, setInstructions] = useState((ex?.instructions ?? []).join("\n"));
  const [initialized, setInitialized] = useState(!editing);

  // Populate the form once the exercise loads when editing.
  if (editing && ex && !initialized) {
    setName(ex.name);
    setLogType(ex.logType);
    setEquipment(ex.equipment ?? "");
    setPrimary(ex.primaryMuscles);
    setSecondary(ex.secondaryMuscles);
    setInstructions(ex.instructions.join("\n"));
    setInitialized(true);
  }

  if (editing && existing.isLoading) {
    return <p className="py-12 text-center text-muted">Loading…</p>;
  }
  if (editing && ex && ex.ownerId == null) {
    return <p className="py-12 text-center text-danger">Bundled exercises can’t be edited.</p>;
  }

  const mutation = editing ? update : create;

  function submit(e: FormEvent) {
    e.preventDefault();
    const input = {
      name: name.trim(),
      logType,
      equipment: equipment.trim() || null,
      primaryMuscles: primary,
      secondaryMuscles: secondary,
      instructions: instructions
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
    };
    const opts = {
      onSuccess: (data: { exercise: { id: number } }) =>
        navigate(`/workouts/exercises/${data.exercise.id}`),
    };
    if (editing) update.mutate({ id: Number(id), ...input }, opts);
    else create.mutate(input, opts);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/workouts" className="text-sm text-muted hover:text-fg">
        ← Back to exercises
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-bold">
        {editing ? "Edit exercise" : "New custom exercise"}
      </h1>
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type (what gets logged)">
              <Select
                value={logType}
                onChange={(e) => setLogType(e.target.value as LogType)}
              >
                {Object.entries(logTypeLabels).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Equipment (optional)">
              <Input
                value={equipment}
                onChange={(e) => setEquipment(e.target.value)}
                placeholder="e.g. barbell, kettlebell"
              />
            </Field>
          </div>
          <MusclePicker
            label="Primary muscles"
            all={meta.data?.muscles ?? []}
            selected={primary}
            onChange={setPrimary}
          />
          <MusclePicker
            label="Secondary muscles"
            all={meta.data?.muscles ?? []}
            selected={secondary}
            onChange={setSecondary}
          />
          <Field label="Instructions (one step per line, optional)">
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
            />
          </Field>
          <ErrorText>{mutation.error?.message}</ErrorText>
          <div className="flex gap-3">
            <Button type="submit" disabled={mutation.isPending}>
              {editing ? "Save changes" : "Create exercise"}
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

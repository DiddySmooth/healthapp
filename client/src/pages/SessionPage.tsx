import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ExercisePicker from "../components/ExercisePicker";
import { Button, Card } from "../components/ui";
import { useMe } from "../lib/auth";
import {
  formatDuration,
  sessionVolume,
  useSession,
  useSessionMutations,
  type SessionExercise,
  type WorkoutSet,
} from "../lib/sessions";

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
  } catch {
    // No audio available; the visual timer is enough.
  }
}

function useTicker(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
}

function prevHint(set: WorkoutSet | undefined, logType: string): string {
  if (!set) return "—";
  if (logType === "strength" || logType === "bodyweight") {
    const w = set.weight != null && set.weight > 0 ? `${set.weight}×` : "";
    return `${w}${set.reps ?? "—"}`;
  }
  const parts: string[] = [];
  if (set.durationSec != null) parts.push(`${Math.round(set.durationSec / 60)}m`);
  if (set.distance != null) parts.push(`${set.distance}`);
  return parts.join(" · ") || "—";
}

function NumberCell({
  value,
  onCommit,
  step = "1",
  placeholder,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  step?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  useEffect(() => {
    setText(value == null ? "" : String(value));
  }, [value]);
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      step={step}
      value={text}
      placeholder={placeholder}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const n = text.trim() === "" ? null : Number(text);
        const next = n != null && Number.isFinite(n) ? n : null;
        if (next !== value) onCommit(next);
      }}
      className="h-11 w-[72px] rounded-[10px] border border-border bg-raised px-2 text-center font-mono text-[17px] font-semibold tabular-nums text-fg focus:border-accent focus:outline-none"
    />
  );
}

function SetRow({
  se,
  set,
  index,
  editable,
  onCompleted,
  mutations,
}: {
  se: SessionExercise;
  set: WorkoutSet;
  index: number;
  editable: boolean;
  onCompleted: () => void;
  mutations: ReturnType<typeof useSessionMutations>;
}) {
  const t = se.exercise.logType;
  const { data: me } = useMe();
  const weightUnit = me?.settings.weightUnit === "kg" ? "kg" : "lb";
  const patch = (p: Partial<WorkoutSet>) =>
    mutations.patchSet.mutate({ seId: se.id, setId: set.id, patch: p });

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
        set.completed ? "bg-accent/[0.06]" : ""
      }`}
    >
      <button
        onClick={() => patch({ isWarmup: !set.isWarmup })}
        disabled={!editable}
        title={set.isWarmup ? "Warmup set" : "Working set"}
        className={`w-7 shrink-0 rounded text-center text-xs font-bold ${
          set.isWarmup ? "bg-accent-3/20 text-accent-3" : "text-faint"
        }`}
      >
        {set.isWarmup ? "W" : index + 1}
      </button>
      <span className="w-16 shrink-0 text-center text-xs text-faint">
        {prevHint(se.previous[index], t)}
      </span>
      <span className="flex flex-1 items-center justify-center gap-1.5">
        {(t === "strength" || t === "bodyweight") && (
          <>
            <NumberCell
              value={set.weight}
              step="0.5"
              placeholder={t === "bodyweight" ? `+${weightUnit}` : weightUnit}
              onCommit={(v) => patch({ weight: v })}
            />
            <span className="text-faint">×</span>
            <NumberCell
              value={set.reps}
              placeholder="reps"
              onCommit={(v) => patch({ reps: v })}
            />
          </>
        )}
        {(t === "cardio" || t === "duration") && (
          <NumberCell
            value={set.durationSec != null ? Math.round(set.durationSec / 60) : null}
            placeholder="min"
            onCommit={(v) => patch({ durationSec: v != null ? v * 60 : null })}
          />
        )}
        {t === "cardio" && (
          <NumberCell
            value={set.distance}
            step="0.1"
            placeholder="dist"
            onCommit={(v) => patch({ distance: v })}
          />
        )}
      </span>
      <button
        onClick={() => {
          const next = !set.completed;
          patch({ completed: next });
          if (next) onCompleted();
        }}
        disabled={!editable}
        aria-label={set.completed ? "Mark incomplete" : "Mark complete"}
        className={`h-11 w-11 shrink-0 rounded-[10px] border text-base font-bold transition-colors ${
          set.completed
            ? "border-accent bg-accent text-bg"
            : "border-border-strong text-faint hover:border-accent hover:text-accent"
        }`}
      >
        ✓
      </button>
      {editable && (
        <button
          onClick={() => mutations.removeSet.mutate({ seId: se.id, setId: set.id })}
          aria-label="Delete set"
          className="shrink-0 text-faint hover:text-danger"
        >
          ✕
        </button>
      )}
    </div>
  );
}


export default function SessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useSession(Number(id));
  const mutations = useSessionMutations(Number(id));
  const [showPicker, setShowPicker] = useState(false);
  // Timestamp-based so the countdown survives re-renders and doesn't drift.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);

  const session = data?.session;
  const active = session != null && session.finishedAt == null;
  useTicker(active || restEndsAt != null);

  const restLeft =
    restEndsAt != null ? Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000)) : null;

  const beeped = useRef(false);
  useEffect(() => {
    if (restLeft === 0 && !beeped.current) {
      beeped.current = true;
      beep();
      try {
        navigator.vibrate?.([120, 60, 120]);
      } catch {
        // vibration unsupported
      }
      setRestEndsAt(null);
    }
    if (restLeft != null && restLeft > 0) beeped.current = false;
  }, [restLeft]);

  function startRest(seconds: number) {
    setRestEndsAt(Date.now() + seconds * 1000);
  }

  if (isLoading) return <p className="py-12 text-center text-muted">Loading…</p>;
  if (!session) return <p className="py-12 text-center text-danger">Session not found.</p>;

  const completedSets = session.exercises.flatMap((se) => se.sets).filter((s) => s.completed);
  const volume = sessionVolume(session);

  function finish() {
    if (!window.confirm("Finish this workout?")) return;
    mutations.patchSession.mutate(
      { id: session!.id, finished: true },
      { onSuccess: () => window.scrollTo(0, 0) },
    );
  }

  function deleteSession() {
    if (!window.confirm("Delete this entire session? This cannot be undone.")) return;
    mutations.removeSession.mutate(session!.id, {
      onSuccess: () => navigate(active ? "/workouts/routines" : "/workouts/history"),
    });
  }

  const restDisplay =
    restLeft != null
      ? `${Math.floor(restLeft / 60)}:${String(restLeft % 60).padStart(2, "0")}`
      : null;

  return (
    <div className="mx-auto max-w-2xl pb-8">
      {/* Pinned clocks: elapsed (volt) + rest countdown (amber), always visible
          below the h-14 navbar while logging. */}
      <div className="sticky top-14 z-10 -mx-4 border-b border-border bg-bg/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <Link
            to={active ? "/workouts/routines" : "/workouts/history"}
            className="shrink-0 text-sm text-muted hover:text-fg"
          >
            ←
          </Link>
          <h1 className="min-w-0 truncate text-lg font-extrabold">
            {session.routineName ?? "Freeform workout"}
          </h1>
          {active ? (
            <span className="ml-auto flex shrink-0 items-center gap-3">
              {restDisplay != null && (
                <button
                  onClick={() => setRestEndsAt(null)}
                  title="Resting — tap to skip"
                  className="flex items-center gap-1.5 rounded-full bg-food/15 px-3 py-1 font-mono text-xl font-bold tabular-nums text-food"
                >
                  {restDisplay}
                  <span className="text-xs font-sans font-semibold opacity-70">skip</span>
                </button>
              )}
              <span className="font-mono text-2xl font-bold tabular-nums text-accent">
                {formatDuration(session.startedAt, null)}
              </span>
            </span>
          ) : (
            <span className="ml-auto shrink-0 text-sm text-muted">
              {new Date(session.startedAt).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          )}
        </div>
      </div>

      <p className="mb-4 mt-3 text-sm text-muted">
        {completedSets.length} sets done
        {volume > 0 && <> · {Math.round(volume).toLocaleString()} total volume</>}
        {!active && session.finishedAt && (
          <> · {formatDuration(session.startedAt, session.finishedAt)} duration</>
        )}
      </p>

      {!active && (
        <Card className="mb-4">
          <p className="text-sm font-medium text-success">✓ Completed workout</p>
          <p className="mt-1 text-sm text-muted">
            You can still edit sets and notes — changes save immediately.
          </p>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {session.exercises.map((se) => (
          <Card key={se.id}>
            <div className="mb-2 flex items-center gap-2">
              <Link
                to={`/workouts/exercises/${se.exerciseId}`}
                className="font-semibold hover:text-accent"
              >
                {se.exercise.name}
              </Link>
              {active && (
                <span className="text-xs text-faint">rest {(se.restSeconds ?? 90)}s</span>
              )}
              <button
                onClick={() => {
                  if (se.sets.length === 0 || window.confirm(`Remove ${se.exercise.name}?`))
                    mutations.removeExercise.mutate(se.id);
                }}
                className="ml-auto text-faint hover:text-danger"
                aria-label="Remove exercise"
              >
                ✕
              </button>
            </div>
            <div className="mb-1 flex items-center gap-2 px-2 text-xs uppercase tracking-wide text-faint">
              <span className="w-7 text-center">Set</span>
              <span className="w-16 text-center">Prev</span>
              <span className="flex-1 text-center">
                {se.exercise.logType === "cardio"
                  ? "Min / Dist"
                  : se.exercise.logType === "duration"
                    ? "Minutes"
                    : "Weight × Reps"}
              </span>
              <span className="w-7 text-center">✓</span>
            </div>
            <div className="flex flex-col gap-1">
              {se.sets.map((set, i) => (
                <SetRow
                  key={set.id}
                  se={se}
                  set={set}
                  index={i}
                  editable
                  onCompleted={active ? () => startRest(se.restSeconds ?? 90) : () => {}}
                  mutations={mutations}
                />
              ))}
            </div>
            <Button
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => mutations.addSet.mutate(se.id)}
            >
              + Add set
            </Button>
          </Card>
        ))}

        {showPicker ? (
          <ExercisePicker
            onPick={(ex) => {
              mutations.addExercise.mutate({ exerciseId: ex.id });
              setShowPicker(false);
            }}
          />
        ) : (
          <Button variant="ghost" onClick={() => setShowPicker(true)}>
            + Add exercise
          </Button>
        )}

        <Card title="Notes">
          <textarea
            defaultValue={session.notes ?? ""}
            onBlur={(e) => {
              const v = e.target.value.trim() || null;
              if (v !== session.notes)
                mutations.patchSession.mutate({ id: session.id, notes: v });
            }}
            rows={2}
            placeholder="How did it go?"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </Card>

        <div className="flex gap-3">
          {active && (
            <Button onClick={finish} className="flex-1">
              Finish workout
            </Button>
          )}
          <Button variant="danger" onClick={deleteSession}>
            Delete
          </Button>
        </div>
      </div>

    </div>
  );
}

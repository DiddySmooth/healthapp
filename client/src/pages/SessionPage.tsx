import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ExercisePicker from "../components/ExercisePicker";
import { Button, Card, Select } from "../components/ui";
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
      className="w-16 rounded-md border border-border bg-surface px-2 py-1.5 text-center text-sm text-fg focus:border-accent focus:outline-none"
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
  const patch = (p: Partial<WorkoutSet>) =>
    mutations.patchSet.mutate({ seId: se.id, setId: set.id, patch: p });

  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
        set.completed ? "bg-success/5" : ""
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
              placeholder={t === "bodyweight" ? "+lb" : "lb"}
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
        className={`h-7 w-7 shrink-0 rounded-md border text-sm font-bold transition-colors ${
          set.completed
            ? "border-success bg-success/20 text-success"
            : "border-border text-faint hover:border-success hover:text-success"
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

const REST_OPTIONS = [30, 60, 90, 120, 180];

export default function SessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading } = useSession(Number(id));
  const mutations = useSessionMutations(Number(id));
  const [showPicker, setShowPicker] = useState(false);
  const [restSeconds, setRestSeconds] = useState(90);
  const [restLeft, setRestLeft] = useState<number | null>(null);
  const restTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const session = data?.session;
  const active = session != null && session.finishedAt == null;
  useTicker(active);

  useEffect(() => {
    return () => {
      if (restTimer.current) clearInterval(restTimer.current);
    };
  }, []);

  function startRest() {
    if (restTimer.current) clearInterval(restTimer.current);
    setRestLeft(restSeconds);
    restTimer.current = setInterval(() => {
      setRestLeft((left) => {
        if (left == null || left <= 1) {
          if (restTimer.current) clearInterval(restTimer.current);
          if (left === 1) beep();
          return null;
        }
        return left - 1;
      });
    }, 1000);
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

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <Link
        to={active ? "/workouts/routines" : "/workouts/history"}
        className="text-sm text-muted hover:text-fg"
      >
        ← {active ? "Workouts" : "History"}
      </Link>

      <div className="mt-2 mb-1 flex items-center gap-3">
        <h1 className="text-2xl font-bold">
          {session.routineName ?? "Freeform workout"}
        </h1>
        {active ? (
          <span className="ml-auto font-mono text-lg text-accent">
            {formatDuration(session.startedAt, null)}
          </span>
        ) : (
          <span className="ml-auto text-sm text-muted">
            {new Date(session.startedAt).toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-muted">
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
                  onCompleted={active ? startRest : () => {}}
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

      {active && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-bg/95 px-4 py-2 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            {restLeft != null ? (
              <>
                <span className="font-mono text-xl text-accent-3">{restLeft}s</span>
                <span className="text-sm text-muted">rest</span>
                <Button variant="ghost" className="ml-auto" onClick={() => setRestLeft(null)}>
                  Skip
                </Button>
              </>
            ) : (
              <>
                <span className="text-sm text-muted">Rest timer</span>
                <Select
                  value={String(restSeconds)}
                  onChange={(e) => setRestSeconds(Number(e.target.value))}
                  className="ml-auto w-24"
                >
                  {REST_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}s
                    </option>
                  ))}
                </Select>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

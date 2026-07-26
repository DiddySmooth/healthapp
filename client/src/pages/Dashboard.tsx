import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Sparkline } from "../components/charts";
import { Button, Card, Input } from "../components/ui";
import { ApiError } from "../lib/api";
import { useMe } from "../lib/auth";
import { todayISO, useDayLog } from "../lib/foods";
import {
  useMetricMutations,
  useMetrics,
  useWaterDay,
  useWaterMutations,
} from "../lib/metrics";
import { useRoutines, useSchedule } from "../lib/routines";
import {
  formatDuration,
  useActiveSession,
  useSessionHistory,
  useSessionMutations,
} from "../lib/sessions";

function Bar({ value, target, color }: { value: number; target: number | null; color: string }) {
  const pct = target != null && target > 0 ? Math.min(100, (value / target) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-surface-2">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function CaloriesCard() {
  const today = todayISO();
  const { data: day } = useDayLog(today);
  const { data: user } = useMe();
  const s = user?.settings;
  const totals = day?.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const remaining =
    s?.calorieTarget != null && s.calorieTarget > 0
      ? Math.round(s.calorieTarget - totals.calories)
      : null;

  return (
    <Link to="/food/log">
      <Card className="h-full transition-colors hover:bg-surface-2/60">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Today's food</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-2xl font-bold">{Math.round(totals.calories)}</span>
          <span className="text-sm text-muted">
            {s?.calorieTarget ? `/ ${s.calorieTarget} cal` : "cal"}
          </span>
          {remaining != null && (
            <span
              className={`ml-auto text-sm font-medium ${remaining < 0 ? "text-danger" : "text-success"}`}
            >
              {remaining < 0 ? `${-remaining} over` : `${remaining} left`}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <Bar value={totals.calories} target={s?.calorieTarget ?? null} color="bg-accent" />
          <div className="grid grid-cols-3 gap-2 text-xs text-muted">
            <span>P {Math.round(totals.protein)}{s?.proteinTarget ? `/${s.proteinTarget}` : ""}g</span>
            <span>C {Math.round(totals.carbs)}{s?.carbsTarget ? `/${s.carbsTarget}` : ""}g</span>
            <span>F {Math.round(totals.fat)}{s?.fatTarget ? `/${s.fatTarget}` : ""}g</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function WorkoutCard() {
  const navigate = useNavigate();
  const { data: activeData } = useActiveSession();
  const { data: scheduleData } = useSchedule();
  const { data: routinesData } = useRoutines();
  const { data: historyData } = useSessionHistory(1);
  const { start } = useSessionMutations();

  const active = activeData?.session;
  const today = new Date();
  const todayIso = todayISO();
  const plannedIds = (scheduleData?.entries ?? [])
    .filter((e) => e.weekday === today.getDay() || e.date === todayIso)
    .map((e) => e.routineId);
  const planned = (routinesData?.routines ?? []).filter((r) => plannedIds.includes(r.id));
  const last = historyData?.sessions[0];

  function startRoutine(routineId: number) {
    start.mutate(
      { routineId },
      {
        onSuccess: (data) => navigate(`/workouts/session/${data.session.id}`),
        onError: (e) => {
          if (e instanceof ApiError && e.code === "ACTIVE_SESSION")
            window.alert("A workout is already in progress.");
        },
      },
    );
  }

  return (
    <Card className="h-full">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Today's workout</p>
      {active ? (
        <button
          onClick={() => navigate(`/workouts/session/${active.id}`)}
          className="mt-2 flex w-full items-center gap-2 rounded-lg bg-accent/10 px-3 py-2 text-left hover:bg-accent/20"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <span className="flex-1 text-sm font-semibold text-accent">
            {active.routineName ?? "Freeform"} — in progress
          </span>
          <span className="font-mono text-xs text-accent">
            {formatDuration(active.startedAt, null)}
          </span>
        </button>
      ) : planned.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2">
          {planned.map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <span className="flex-1 text-sm font-medium">{r.name}</span>
              <span className="text-xs text-faint">{r.exercises.length} exercises</span>
              <Button onClick={() => startRoutine(r.id)} className="px-3 py-1">
                Start
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-2">
          <p className="text-sm text-muted">Nothing scheduled for today.</p>
          {last && (
            <p className="mt-1 text-xs text-faint">
              Last workout: {last.routineName ?? "Freeform"} ·{" "}
              {new Date(last.startedAt).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </p>
          )}
          <Link to="/workouts/routines" className="mt-2 inline-block text-sm text-accent">
            Browse routines →
          </Link>
        </div>
      )}
    </Card>
  );
}

const WATER_QUICK = [250, 500, 750];

function WaterCard() {
  const today = todayISO();
  const { data } = useWaterDay(today);
  const { data: user } = useMe();
  const { add, remove } = useWaterMutations();
  const target = user?.settings.waterTargetMl ?? null;
  const total = data?.totalMl ?? 0;
  const lastEntry = data?.entries[data.entries.length - 1];

  return (
    <Card className="h-full">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Water</p>
      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold">{(total / 1000).toFixed(2)}</span>
        <span className="text-sm text-muted">{target ? `/ ${(target / 1000).toFixed(1)} L` : "L"}</span>
      </div>
      <div className="mt-3">
        <Bar value={total} target={target} color="bg-accent" />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {WATER_QUICK.map((ml) => (
          <Button
            key={ml}
            variant="ghost"
            className="px-3 py-1 text-xs"
            onClick={() => add.mutate({ date: today, amountMl: ml })}
          >
            +{ml}ml
          </Button>
        ))}
        {lastEntry && (
          <Button
            variant="ghost"
            className="ml-auto px-3 py-1 text-xs"
            onClick={() => remove.mutate(lastEntry.id)}
          >
            Undo
          </Button>
        )}
      </div>
    </Card>
  );
}

function WeightCard() {
  const { data } = useMetrics("weight");
  const { add } = useMetricMutations();
  const { data: user } = useMe();
  const [value, setValue] = useState("");
  const metrics = data?.metrics ?? [];
  const latest = metrics[0];
  const spark = [...metrics.slice(0, 30)].reverse().map((m) => ({ v: m.value }));
  const unit = user?.settings.weightUnit ?? "lbs";

  return (
    <Card className="h-full">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Body weight</p>
      <div className="mt-1 flex items-center gap-3">
        <div>
          <span className="text-2xl font-bold">{latest ? latest.value : "—"}</span>
          <span className="ml-1 text-sm text-muted">{unit}</span>
          {latest && (
            <p className="text-xs text-faint">
              {new Date(`${latest.date}T00:00:00`).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </p>
          )}
        </div>
        {spark.length > 1 && (
          <div className="h-10 flex-1">
            <Sparkline data={spark} dataKey="v" color="#22d3ee" />
          </div>
        )}
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number(value);
          if (Number.isFinite(n) && n > 0) {
            add.mutate(
              { date: todayISO(), type: "weight", value: n },
              { onSuccess: () => setValue("") },
            );
          }
        }}
      >
        <Input
          type="number"
          inputMode="decimal"
          step="0.1"
          min={1}
          placeholder={`Log today's weight (${unit})`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button type="submit" variant="ghost" disabled={value.trim() === ""}>
          Log
        </Button>
      </form>
    </Card>
  );
}

export default function Dashboard() {
  const { data: user } = useMe();
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">
        {greeting}, {user?.username}
      </h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <CaloriesCard />
        <WorkoutCard />
        <WaterCard />
        <WeightCard />
      </div>
      <p className="mt-4 text-center text-xs text-faint">
        <Link to="/progress" className="text-accent">
          View progress charts →
        </Link>
      </p>
    </div>
  );
}

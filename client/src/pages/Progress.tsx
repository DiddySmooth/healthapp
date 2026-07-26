import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ChartCard, DailyBars, TrendLines, shortDate } from "../components/charts";
import { Button, Card, Field, Input, Select } from "../components/ui";
import { api } from "../lib/api";
import { useMe } from "../lib/auth";
import { todayISO } from "../lib/foods";
import { useExercises } from "../lib/exercises";
import {
  metricTypes,
  useCaloriesHistory,
  useMetricMutations,
  useMetrics,
  useVolumeHistory,
  useWaterHistory,
  type MetricType,
} from "../lib/metrics";
import type { WorkoutSet } from "../lib/sessions";

const ACCENT = "#22d3ee";
const ACCENT2 = "#a78bfa";

function WeightChart() {
  const { data } = useMetrics("weight");
  const points = [...(data?.metrics ?? [])]
    .reverse()
    .map((m) => ({ date: m.date, weight: m.value }));
  const { data: user } = useMe();
  return (
    <ChartCard
      title="Body weight"
      subtitle={`Trend over time (${user?.settings.weightUnit ?? "lbs"})`}
      empty={points.length < 2}
    >
      <TrendLines
        data={points}
        series={[{ dataKey: "weight", color: ACCENT, name: "Weight" }]}
        unit={user?.settings.weightUnit ?? "lbs"}
      />
    </ChartCard>
  );
}

function CaloriesChart() {
  const { data } = useCaloriesHistory(30);
  const { data: user } = useMe();
  const days = data?.days ?? [];
  const any = days.some((d) => d.calories > 0);
  return (
    <ChartCard title="Calories" subtitle="Daily intake, last 30 days" empty={!any}>
      <DailyBars
        data={days}
        dataKey="calories"
        color={ACCENT}
        target={user?.settings.calorieTarget}
        unit="cal"
      />
    </ChartCard>
  );
}

type ExerciseStats = {
  history: { sessionId: number; date: string; sets: WorkoutSet[] }[];
};

function epley(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function StrengthChart() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ id: number; name: string } | null>(null);
  const options = useExercises({ search, pageSize: 8 });
  const stats = useQuery({
    queryKey: ["stats", "exercise", selected?.id],
    queryFn: () => api.get<ExerciseStats>(`/api/stats/exercise/${selected!.id}`),
    enabled: selected != null,
  });

  const points = [...(stats.data?.history ?? [])].reverse().map((h) => {
    const working = h.sets.filter((s) => !s.isWarmup && (s.weight ?? 0) > 0);
    const top = Math.max(0, ...working.map((s) => s.weight ?? 0));
    const oneRm = Math.max(0, ...working.map((s) => epley(s.weight ?? 0, s.reps ?? 0)));
    return { date: h.date.slice(0, 10), top, oneRm };
  }).filter((p) => p.top > 0);

  return (
    <Card>
      <h2 className="text-base font-semibold">Strength progression</h2>
      <p className="mb-2 text-xs text-muted">
        Top working set and estimated 1RM per session
      </p>
      <div className="relative">
        <Input
          placeholder={selected ? selected.name : "Search an exercise…"}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search.trim() !== "" && (
          <ul className="absolute z-10 mt-1 max-h-48 w-full divide-y divide-border overflow-y-auto rounded-lg border border-border bg-bg shadow-lg">
            {options.data?.exercises.map((ex) => (
              <li key={ex.id}>
                <button
                  onClick={() => {
                    setSelected({ id: ex.id, name: ex.name });
                    setSearch("");
                  }}
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-surface-2"
                >
                  {ex.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {selected == null ? (
        <p className="py-10 text-center text-sm text-faint">
          Pick an exercise to see its progression.
        </p>
      ) : points.length < 2 ? (
        <p className="py-10 text-center text-sm text-faint">
          Not enough logged sessions for {selected.name} yet.
        </p>
      ) : (
        <>
          <div className="mt-3 h-56">
            <TrendLines
              data={points}
              series={[
                { dataKey: "top", color: ACCENT, name: "Top set" },
                { dataKey: "oneRm", color: ACCENT2, name: "Est. 1RM" },
              ]}
            />
          </div>
          <div className="mt-2 flex justify-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: ACCENT }} />
              Top set
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: ACCENT2 }} />
              Est. 1RM
            </span>
          </div>
        </>
      )}
    </Card>
  );
}

function VolumeChart() {
  const { data } = useVolumeHistory(8);
  const weeks = (data?.weeks ?? []).map((w) => ({ date: w.weekStart, total: w.total }));
  const any = weeks.some((w) => w.total > 0);
  return (
    <ChartCard
      title="Training volume"
      subtitle="Completed working volume (weight × reps) per week"
      empty={!any}
    >
      <DailyBars data={weeks} dataKey="total" color={ACCENT2} />
    </ChartCard>
  );
}

function WaterChart() {
  const { data } = useWaterHistory(14);
  const { data: user } = useMe();
  const days = data?.days ?? [];
  const any = days.some((d) => d.totalMl > 0);
  return (
    <ChartCard title="Water" subtitle="Daily intake (ml), last 14 days" empty={!any}>
      <DailyBars
        data={days}
        dataKey="totalMl"
        color={ACCENT}
        target={user?.settings.waterTargetMl}
        unit="ml"
      />
    </ChartCard>
  );
}

const typeLabels: Record<MetricType, string> = {
  weight: "Weight",
  waist: "Waist",
  chest: "Chest",
  hips: "Hips",
  arm: "Arm",
  thigh: "Thigh",
  calf: "Calf",
  neck: "Neck",
  bodyfat: "Body fat %",
};

function MetricsLog() {
  const { data } = useMetrics();
  const { add, remove } = useMetricMutations();
  const [type, setType] = useState<MetricType>("weight");
  const [value, setValue] = useState("");
  const [date, setDate] = useState(todayISO());

  function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return;
    add.mutate({ date, type, value: n }, { onSuccess: () => setValue("") });
  }

  return (
    <Card title="Measurements">
      <form onSubmit={submit} className="mb-3 flex flex-wrap items-end gap-3">
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as MetricType)}>
            {metricTypes.map((t) => (
              <option key={t} value={t}>
                {typeLabels[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Value">
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />
        </Field>
        <Field label="Date">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Button type="submit" disabled={add.isPending}>
          Log
        </Button>
      </form>
      <ul className="max-h-64 divide-y divide-border overflow-y-auto">
        {(data?.metrics ?? []).slice(0, 50).map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-1.5 text-sm">
            <span className="w-20 text-muted">{shortDate(m.date)}</span>
            <span className="flex-1">{typeLabels[m.type]}</span>
            <span className="font-medium">{m.value}</span>
            <button
              onClick={() => remove.mutate(m.id)}
              className="text-faint hover:text-danger"
              aria-label="Delete"
            >
              ✕
            </button>
          </li>
        ))}
        {(data?.metrics ?? []).length === 0 && (
          <li className="py-3 text-center text-sm text-faint">No measurements yet.</li>
        )}
      </ul>
    </Card>
  );
}

export default function Progress() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Progress</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <WeightChart />
        <CaloriesChart />
        <StrengthChart />
        <VolumeChart />
        <WaterChart />
        <MetricsLog />
      </div>
    </div>
  );
}

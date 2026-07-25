import { useState } from "react";
import { Button, Card, Select } from "../components/ui";
import { useMe } from "../lib/auth";
import {
  useRoutines,
  useSchedule,
  useScheduleMutations,
  type Routine,
  type ScheduleEntry,
} from "../lib/routines";

const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthGrid(year: number, month: number, weekStartsMonday: boolean): Date[][] {
  const first = new Date(year, month, 1);
  const start = new Date(first);
  const offset = weekStartsMonday ? (first.getDay() + 6) % 7 : first.getDay();
  start.setDate(first.getDate() - offset);
  const weeks: Date[][] = [];
  const cursor = new Date(start);
  do {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  } while (cursor.getMonth() === month);
  return weeks;
}

function AddRoutineSelect({
  routines,
  onAdd,
  label = "+ Add routine…",
}: {
  routines: Routine[];
  onAdd: (routineId: number) => void;
  label?: string;
}) {
  return (
    <Select
      value=""
      onChange={(e) => {
        if (e.target.value) onAdd(Number(e.target.value));
      }}
      className="text-xs"
    >
      <option value="">{label}</option>
      {routines.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </Select>
  );
}

export default function CalendarPage() {
  const { data: user } = useMe();
  const routinesQuery = useRoutines();
  const scheduleQuery = useSchedule();
  const { create, remove } = useScheduleMutations();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const weekStartsMonday = (user?.settings.weekStart ?? "monday") === "monday";
  const routines = routinesQuery.data?.routines.filter((r) => !r.isArchived) ?? [];
  const entries = scheduleQuery.data?.entries ?? [];
  const routineName = (id: number) =>
    routines.find((r) => r.id === id)?.name ?? "Unknown";

  const weekdayOrder = weekStartsMonday ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  const recurring = (weekday: number) => entries.filter((e) => e.weekday === weekday);
  const oneOffs = (date: string) => entries.filter((e) => e.date === date);
  const entriesFor = (d: Date): ScheduleEntry[] => [
    ...recurring(d.getDay()),
    ...oneOffs(toISO(d)),
  ];

  function changeMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedDay(null);
  }

  const monthLabel = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <Card title="Weekly schedule">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {weekdayOrder.map((wd) => (
            <div key={wd} className="rounded-lg bg-surface-2/50 p-2">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
                {dayNames[wd]}
              </p>
              <ul className="mb-1 flex flex-col gap-1">
                {recurring(wd).map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center gap-1 rounded bg-surface px-2 py-1 text-sm"
                  >
                    <span className="flex-1 truncate">{routineName(e.routineId)}</span>
                    <button
                      onClick={() => remove.mutate(e.id)}
                      className="text-faint hover:text-danger"
                      aria-label="Remove"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <AddRoutineSelect
                routines={routines}
                onAdd={(routineId) => create.mutate({ routineId, weekday: wd })}
              />
            </div>
          ))}
        </div>
        {routines.length === 0 && (
          <p className="mt-3 text-sm text-faint">
            Create a routine first, then schedule it here.
          </p>
        )}
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{monthLabel}</h2>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => changeMonth(-1)}>
              ‹
            </Button>
            <Button variant="ghost" onClick={() => changeMonth(1)}>
              ›
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-faint">
          {weekdayOrder.map((wd) => (
            <div key={wd} className="py-1">
              {dayNames[wd]!.slice(0, 3)}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {monthGrid(year, month, weekStartsMonday).map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((d) => {
                const iso = toISO(d);
                const dayEntries = entriesFor(d);
                const isToday = iso === toISO(today);
                const inMonth = d.getMonth() === month;
                return (
                  <button
                    key={iso}
                    onClick={() => setSelectedDay(selectedDay === iso ? null : iso)}
                    className={`min-h-16 rounded-lg p-1 text-left align-top text-xs transition-colors ${
                      inMonth ? "bg-surface-2/50" : "bg-surface-2/20 text-faint"
                    } ${selectedDay === iso ? "ring-2 ring-accent" : ""} hover:bg-surface-2`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full text-center leading-5 ${
                        isToday ? "bg-accent font-bold text-bg" : ""
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    {dayEntries.slice(0, 2).map((e) => (
                      <p
                        key={e.id}
                        className={`truncate rounded px-1 ${
                          e.date != null
                            ? "bg-accent-2/20 text-accent-2"
                            : "bg-accent/10 text-accent"
                        }`}
                      >
                        {routineName(e.routineId)}
                      </p>
                    ))}
                    {dayEntries.length > 2 && (
                      <p className="text-faint">+{dayEntries.length - 2} more</p>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {selectedDay && (
          <div className="mt-3 rounded-lg border border-border p-3">
            <p className="mb-2 text-sm font-medium">
              {new Date(`${selectedDay}T00:00:00`).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <ul className="mb-2 flex flex-col gap-1">
              {entriesFor(new Date(`${selectedDay}T00:00:00`)).map((e) => (
                <li key={e.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">
                    {routineName(e.routineId)}
                    <span className="ml-2 text-xs text-faint">
                      {e.date != null ? "one-off" : "recurring"}
                    </span>
                  </span>
                  {e.date != null && (
                    <button
                      onClick={() => remove.mutate(e.id)}
                      className="text-faint hover:text-danger"
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <AddRoutineSelect
              routines={routines}
              label="+ Schedule routine on this day…"
              onAdd={(routineId) => create.mutate({ routineId, date: selectedDay })}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

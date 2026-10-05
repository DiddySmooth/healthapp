import { useQuery } from "@tanstack/react-query";
import { Card } from "./ui";
import { api } from "../lib/api";
import { useMe } from "../lib/auth";

type Day = { date: string; count: number };

function useWorkoutDays() {
  return useQuery({
    queryKey: ["stats", "workout-days"],
    queryFn: () => api.get<{ days: Day[] }>("/api/stats/workout-days?days=365"),
  });
}

// Sequential single-hue scale on the theme accent: none → light → full.
function cellColor(count: number): string {
  if (count <= 0) return "#1C1E22";
  if (count === 1) return "#C8F04B99";
  return "#C8F04B";
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function WorkoutHeatmap() {
  const { data } = useWorkoutDays();
  const { data: user } = useMe();
  const weekStartsMonday = (user?.settings.weekStart ?? "monday") === "monday";

  const days = data?.days ?? [];
  if (days.length === 0) return null;

  // Column-align: pad the front so the first column starts on the week start.
  const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00`).getDay();
  const offset = weekStartsMonday
    ? (weekdayOf(days[0]!.date) + 6) % 7
    : weekdayOf(days[0]!.date);
  const padded: (Day | null)[] = [...Array<null>(offset).fill(null), ...days];
  const weeks: (Day | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  const total = days.reduce((sum, d) => sum + (d.count > 0 ? 1 : 0), 0);
  const dayLabels = weekStartsMonday ? ["Mon", "Wed", "Fri"] : ["Sun", "Tue", "Thu"];

  // A month label above the first column containing that month's 1st.
  const monthLabel = (week: (Day | null)[]): string => {
    const first = week.find((d) => d != null);
    if (!first) return "";
    const date = new Date(`${first.date}T00:00:00`);
    return date.getDate() <= 7 ? monthNames[date.getMonth()]! : "";
  };

  return (
    <Card className="lg:col-span-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-base font-semibold">Workout days</h2>
        <span className="text-xs text-muted">
          {total} workout day{total === 1 ? "" : "s"} in the last year
        </span>
      </div>
      <div className="mt-3 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-[3px]">
          <div className="mr-1 flex flex-col gap-[3px] text-[9px] leading-[11px] text-faint">
            {/* spacer matching the month-label row */}
            <span className="h-[11px]" />
            {[0, 1, 2, 3, 4, 5, 6].map((row) => (
              <span key={row} className="h-[11px]">
                {row % 2 === 0 ? dayLabels[row / 2] : ""}
              </span>
            ))}
          </div>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              <span className="h-[11px] text-[9px] leading-[11px] text-faint">
                {monthLabel(week)}
              </span>
              {Array.from({ length: 7 }, (_, row) => {
                const day = week[row];
                return day ? (
                  <span
                    key={row}
                    title={`${new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })} — ${day.count} workout${day.count === 1 ? "" : "s"}`}
                    className="h-[11px] w-[11px] rounded-[2px]"
                    style={{ backgroundColor: cellColor(day.count) }}
                  />
                ) : (
                  <span key={row} className="h-[11px] w-[11px]" />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-faint">
        Less
        {[0, 1, 2].map((n) => (
          <span
            key={n}
            className="h-[10px] w-[10px] rounded-[2px]"
            style={{ backgroundColor: cellColor(n) }}
          />
        ))}
        More
      </div>
    </Card>
  );
}

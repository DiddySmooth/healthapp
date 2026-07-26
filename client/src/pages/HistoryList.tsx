import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card } from "../components/ui";
import { formatDuration, useSessionHistory } from "../lib/sessions";

export default function HistoryList() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSessionHistory(page);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">History</h1>
      {isLoading ? (
        <p className="py-12 text-center text-muted">Loading…</p>
      ) : data?.sessions.length === 0 ? (
        <Card>
          <p className="text-center text-muted">
            No workouts logged yet. Start one from the Routines tab.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {data?.sessions.map((s) => (
            <Link key={s.id} to={`/workouts/session/${s.id}`}>
              <Card className="transition-colors hover:bg-surface-2/70">
                <div className="flex flex-wrap items-baseline gap-2">
                  <h3 className="font-semibold">{s.routineName ?? "Freeform workout"}</h3>
                  <span className="text-sm text-muted">
                    {new Date(s.startedAt).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="ml-auto text-sm text-faint">
                    {formatDuration(s.startedAt, s.finishedAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {s.exerciseCount} exercises · {s.setCount} sets
                  {s.volume > 0 && <> · {Math.round(s.volume).toLocaleString()} volume</>}
                </p>
              </Card>
            </Link>
          ))}
          <div className="flex justify-center gap-3">
            {page > 1 && (
              <Button variant="ghost" onClick={() => setPage(page - 1)}>
                Newer
              </Button>
            )}
            {(data?.sessions.length ?? 0) === 20 && (
              <Button variant="ghost" onClick={() => setPage(page + 1)}>
                Older
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { formatDuration, useActiveSession } from "../lib/sessions";

const tabs = [
  { to: "/workouts/exercises", label: "Exercises" },
  { to: "/workouts/routines", label: "Routines" },
  { to: "/workouts/calendar", label: "Calendar" },
  { to: "/workouts/history", label: "History" },
];

export default function WorkoutsLayout() {
  const { data } = useActiveSession();
  const navigate = useNavigate();
  const location = useLocation();
  const active = data?.session ?? null;
  const onSessionPage = location.pathname.startsWith("/workouts/session/");

  return (
    <div>
      {active && !onSessionPage && (
        <button
          onClick={() => navigate(`/workouts/session/${active.id}`)}
          className="mb-4 flex w-full items-center gap-3 rounded-xl bg-accent/10 px-4 py-3 text-left transition-colors hover:bg-accent/20"
        >
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-accent" />
          <span className="flex-1">
            <span className="block text-sm font-semibold text-accent">
              Workout in progress — {active.routineName ?? "Freeform"}
            </span>
            <span className="text-xs text-muted">Tap to resume</span>
          </span>
          <span className="font-mono text-sm text-accent">
            {formatDuration(active.startedAt, null)}
          </span>
        </button>
      )}
      {!onSessionPage && (
        <div className="mb-5 flex gap-1 rounded-xl bg-surface p-1">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `flex-1 rounded-lg px-2 py-2 text-center text-sm font-medium transition-colors ${
                  isActive ? "bg-surface-2 text-accent" : "text-muted hover:text-fg"
                }`
              }
            >
              {t.label}
            </NavLink>
          ))}
        </div>
      )}
      <Outlet />
    </div>
  );
}

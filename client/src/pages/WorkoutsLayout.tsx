import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/workouts/exercises", label: "Exercises" },
  { to: "/workouts/routines", label: "Routines" },
  { to: "/workouts/calendar", label: "Calendar" },
];

export default function WorkoutsLayout() {
  return (
    <div>
      <div className="mb-5 flex gap-1 rounded-xl bg-surface p-1">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              `flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
                isActive ? "bg-surface-2 text-accent" : "text-muted hover:text-fg"
              }`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}

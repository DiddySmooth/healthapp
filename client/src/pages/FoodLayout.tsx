import { NavLink, Outlet } from "react-router-dom";

const tabs = [
  { to: "/food/log", label: "Daily Log" },
  { to: "/food/foods", label: "My Foods" },
];

export default function FoodLayout() {
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

import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useLogout, useMe } from "../lib/auth";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/workouts", label: "Workouts" },
  { to: "/food", label: "Food" },
  { to: "/progress", label: "Progress" },
  { to: "/settings", label: "Settings" },
];

function navClass({ isActive }: { isActive: boolean }): string {
  return `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? "bg-surface-2 text-accent" : "text-muted hover:text-fg"
  }`;
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  const { data: user } = useMe();
  const logout = useLogout();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          <NavLink to="/" className="mr-4 text-lg font-bold">
            Health<span className="text-accent">App</span>
          </NavLink>

          <nav className="hidden gap-1 md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === "/"} className={navClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto hidden items-center gap-3 md:flex">
            <span className="text-sm text-muted">{user?.username}</span>
            <button
              onClick={() => logout.mutate()}
              className="text-sm text-muted hover:text-fg"
            >
              Log out
            </button>
          </div>

          <button
            className="ml-auto rounded-lg p-2 text-muted hover:text-fg md:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              {open ? (
                <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" />
              ) : (
                <path d="M2 5h16M2 10h16M2 15h16" stroke="currentColor" strokeWidth="2" />
              )}
            </svg>
          </button>
        </div>

        {open && (
          <nav className="flex flex-col gap-1 border-t border-border px-4 py-2 md:hidden">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={navClass}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </NavLink>
            ))}
            <button
              onClick={() => logout.mutate()}
              className="rounded-lg px-3 py-2 text-left text-sm font-medium text-muted hover:text-fg"
            >
              Log out ({user?.username})
            </button>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

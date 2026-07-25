import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuthStatus, useMe } from "./lib/auth";
import Login from "./pages/Login";
import Placeholder from "./pages/Placeholder";
import Settings from "./pages/Settings";
import SetupWizard from "./pages/SetupWizard";

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted">Loading…</p>
    </div>
  );
}

export default function App() {
  const status = useAuthStatus();
  const me = useMe();

  if (status.isLoading || me.isLoading) return <Splash />;
  if (status.data?.needsSetup) return <SetupWizard />;
  if (!me.data) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Placeholder title="Dashboard" />} />
        <Route path="workouts" element={<Placeholder title="Workouts" />} />
        <Route path="food" element={<Placeholder title="Food" />} />
        <Route path="progress" element={<Placeholder title="Progress" />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

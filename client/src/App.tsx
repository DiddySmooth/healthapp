import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuthStatus, useMe } from "./lib/auth";
import CalendarPage from "./pages/CalendarPage";
import ExerciseDetail from "./pages/ExerciseDetail";
import HistoryList from "./pages/HistoryList";
import SessionPage from "./pages/SessionPage";
import ExerciseForm from "./pages/ExerciseForm";
import ExerciseLibrary from "./pages/ExerciseLibrary";
import Login from "./pages/Login";
import RoutineForm from "./pages/RoutineForm";
import RoutineList from "./pages/RoutineList";
import WorkoutsLayout from "./pages/WorkoutsLayout";
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
        <Route path="workouts" element={<WorkoutsLayout />}>
          <Route index element={<Navigate to="exercises" replace />} />
          <Route path="exercises" element={<ExerciseLibrary />} />
          <Route path="exercises/new" element={<ExerciseForm />} />
          <Route path="exercises/:id" element={<ExerciseDetail />} />
          <Route path="exercises/:id/edit" element={<ExerciseForm />} />
          <Route path="routines" element={<RoutineList />} />
          <Route path="routines/new" element={<RoutineForm />} />
          <Route path="routines/:id/edit" element={<RoutineForm />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="history" element={<HistoryList />} />
          <Route path="session/:id" element={<SessionPage />} />
        </Route>
        <Route path="food" element={<Placeholder title="Food" />} />
        <Route path="progress" element={<Placeholder title="Progress" />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

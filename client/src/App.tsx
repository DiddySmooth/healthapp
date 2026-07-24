import { useQuery } from "@tanstack/react-query";
import { Route, Routes } from "react-router-dom";

function Home() {
  const health = useQuery({
    queryKey: ["healthz"],
    queryFn: async () => {
      const res = await fetch("/healthz");
      if (!res.ok) throw new Error("health check failed");
      return (await res.json()) as { status: string };
    },
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-3xl font-bold">
        Health<span className="text-accent">App</span>
      </h1>
      <p className="text-muted">Self-hosted workout & nutrition tracker</p>
      <div className="rounded-lg bg-surface px-4 py-2 text-sm">
        Server:{" "}
        {health.isLoading ? (
          <span className="text-faint">checking…</span>
        ) : health.isError ? (
          <span className="text-danger">unreachable</span>
        ) : (
          <span className="text-success">{health.data?.status}</span>
        )}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<Home />} />
    </Routes>
  );
}

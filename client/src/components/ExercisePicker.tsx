import { useState } from "react";
import { Input } from "./ui";
import { logTypeLabels, useExercises, type Exercise } from "../lib/exercises";

export default function ExercisePicker({ onPick }: { onPick: (ex: Exercise) => void }) {
  const [search, setSearch] = useState("");
  const results = useExercises({ search, pageSize: 8 });
  return (
    <div className="rounded-lg border border-border p-3">
      <Input
        placeholder="Search exercises to add…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />
      {search.trim() !== "" && (
        <ul className="mt-2 max-h-56 divide-y divide-border overflow-y-auto">
          {results.data?.exercises.map((ex) => (
            <li key={ex.id}>
              <button
                type="button"
                onClick={() => onPick(ex)}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-surface-2"
              >
                <span className="flex-1 truncate">{ex.name}</span>
                <span className="text-xs text-faint">{logTypeLabels[ex.logType]}</span>
              </button>
            </li>
          ))}
          {results.data?.exercises.length === 0 && (
            <li className="px-2 py-1.5 text-sm text-faint">No matches.</li>
          )}
        </ul>
      )}
    </div>
  );
}

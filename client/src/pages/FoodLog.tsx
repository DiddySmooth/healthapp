import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Input } from "../components/ui";

// Lazy: the ZXing decoder is ~150KB and only needed when scanning.
const BarcodeScanner = lazy(() => import("../components/BarcodeScanner"));
import { useMe } from "../lib/auth";
import {
  mealLabels,
  meals,
  shiftDate,
  todayISO,
  useDayLog,
  useFoodMutations,
  useFoods,
  useLogMutations,
  useLookup,
  useRecentFoods,
  type Food,
  type LogEntry,
  type LookupResult,
  type MacroTotals,
  type Meal,
} from "../lib/foods";

function MacroBar({
  label,
  value,
  target,
  color,
  unit = "g",
}: {
  label: string;
  value: number;
  target: number | null;
  color: string;
  unit?: string;
}) {
  const pct = target != null && target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const over = target != null && target > 0 && value > target;
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={over ? "text-danger" : "text-fg"}>
          {Math.round(value)}
          {target != null && target > 0 && (
            <span className="text-faint"> / {Math.round(target)}{unit === "g" ? "g" : ""}</span>
          )}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-surface-2">
        <div
          className={`h-1.5 rounded-full ${over ? "bg-danger" : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function AddFoodPanel({
  date,
  meal,
  onDone,
}: {
  date: string;
  meal: Meal;
  onDone: () => void;
}) {
  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [servings, setServings] = useState<Record<number, string>>({});
  const [searchedFor, setSearchedFor] = useState("");
  const results = useFoods(search.trim());
  const recents = useRecentFoods();
  const { add } = useLogMutations();
  const { create } = useFoodMutations();
  const lookup = useLookup();

  const list = search.trim() !== "" ? results.data?.foods : recents.data?.foods;
  const heading = search.trim() !== "" ? "Your foods" : "Recent foods";

  function logFood(food: Food) {
    const n = Number(servings[food.id] ?? "1");
    add.mutate(
      { foodId: food.id, date, meal, servings: Number.isFinite(n) && n > 0 ? n : 1 },
      { onSuccess: onDone },
    );
  }

  // One tap: save the database result to My Foods, then log it to this meal.
  function importAndLog(r: LookupResult) {
    create.mutate(
      {
        name: r.name,
        brand: r.brand,
        barcode: r.barcode,
        servingSize: r.servingSize,
        servingUnit: r.servingUnit,
        calories: r.calories ?? 0,
        protein: r.protein ?? 0,
        carbs: r.carbs ?? 0,
        fat: r.fat ?? 0,
        fiber: r.fiber,
        sugar: r.sugar,
        sodium: r.sodium,
      },
      {
        onSuccess: (data) =>
          add.mutate(
            { foodId: data.food.id, date, meal, servings: 1 },
            { onSuccess: onDone },
          ),
      },
    );
  }

  function searchDatabase() {
    const q = search.trim();
    if (!q) return;
    setSearchedFor(q);
    lookup.mutate({ q });
  }

  function searchBarcode(code = barcode.trim()) {
    if (!code) return;
    setSearchedFor(`barcode:${code}`);
    lookup.mutate({ barcode: code });
  }

  function onScanned(code: string) {
    setScanning(false);
    setBarcode(code);
    searchBarcode(code);
  }

  const lookupFresh =
    lookup.data != null &&
    (searchedFor === search.trim() || searchedFor === `barcode:${barcode.trim()}`);

  return (
    <div className="mt-2 rounded-lg border border-border p-3">
      <div className="flex gap-2">
        <Input
          placeholder="Search foods…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        <Link to={`/food/foods/new?returnTo=${date}:${meal}`}>
          <Button variant="ghost" className="whitespace-nowrap">
            + New food
          </Button>
        </Link>
      </div>

      <p className="mt-2 mb-1 text-xs font-medium uppercase tracking-wide text-faint">
        {heading}
      </p>
      <ul className="max-h-48 divide-y divide-border overflow-y-auto">
        {(list ?? []).map((food) => (
          <li key={food.id} className="flex items-center gap-2 py-1.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{food.name}</p>
              <p className="text-xs text-faint">
                {food.servingSize} {food.servingUnit} · {Math.round(food.calories)} cal ·
                P{food.protein} C{food.carbs} F{food.fat}
              </p>
            </div>
            <input
              type="number"
              inputMode="decimal"
              min={0.1}
              step="0.5"
              value={servings[food.id] ?? "1"}
              onChange={(e) => setServings({ ...servings, [food.id]: e.target.value })}
              className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-center text-sm"
              aria-label="Servings"
            />
            <Button onClick={() => logFood(food)} className="px-3 py-1">
              Add
            </Button>
          </li>
        ))}
        {(list ?? []).length === 0 && (
          <li className="py-2 text-sm text-faint">
            {search.trim() !== ""
              ? "Nothing in your foods — try the food database below."
              : "Foods you log will appear here for quick re-adding."}
          </li>
        )}
      </ul>

      <p className="mt-3 mb-1 text-xs font-medium uppercase tracking-wide text-faint">
        Food database (Open Food Facts)
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="ghost"
          className="flex-1 whitespace-nowrap"
          disabled={search.trim() === "" || lookup.isPending}
          onClick={searchDatabase}
        >
          {lookup.isPending
            ? "Searching…"
            : search.trim()
              ? `Search database for “${search.trim()}”`
              : "Type a name above to search"}
        </Button>
        <div className="flex gap-1">
          <Button variant="ghost" onClick={() => setScanning(true)} title="Scan with camera">
            📷 Scan
          </Button>
          <Input
            placeholder="Barcode"
            inputMode="numeric"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") searchBarcode();
            }}
            className="w-32"
          />
          <Button
            variant="ghost"
            disabled={barcode.trim() === "" || lookup.isPending}
            onClick={() => searchBarcode()}
          >
            Go
          </Button>
        </div>
      </div>
      {scanning && (
        <Suspense fallback={null}>
          <BarcodeScanner onDetected={onScanned} onClose={() => setScanning(false)} />
        </Suspense>
      )}
      {lookup.error && (
        <p className="mt-1 text-sm text-danger">{lookup.error.message}</p>
      )}
      {lookupFresh && (
        <ul className="mt-1 max-h-48 divide-y divide-border overflow-y-auto">
          {lookup.data!.results.map((r, i) => (
            <li key={i} className="flex items-center gap-2 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {r.name}
                  {r.brand && <span className="text-faint"> — {r.brand}</span>}
                </p>
                <p className="text-xs text-faint">
                  {r.servingSize} {r.servingUnit} · {r.calories ?? "?"} cal · P
                  {r.protein ?? "?"} C{r.carbs ?? "?"} F{r.fat ?? "?"}
                </p>
              </div>
              <Button
                onClick={() => importAndLog(r)}
                disabled={create.isPending || r.calories == null}
                className="px-3 py-1"
              >
                Add
              </Button>
            </li>
          ))}
          {lookup.data!.results.length === 0 && (
            <li className="py-2 text-sm text-faint">
              No database matches — add it manually with “+ New food”.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function EntryRow({ entry }: { entry: LogEntry }) {
  const { update, remove } = useLogMutations();
  return (
    <li className="flex items-center gap-2 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{entry.food.name}</p>
        <p className="text-xs text-faint">
          {entry.servings} × {entry.food.servingSize} {entry.food.servingUnit} · P
          {entry.macros.protein} C{entry.macros.carbs} F{entry.macros.fat}
        </p>
      </div>
      <input
        type="number"
        inputMode="decimal"
        min={0.1}
        step="0.5"
        defaultValue={entry.servings}
        key={`${entry.id}-${entry.servings}`}
        onBlur={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n) && n > 0 && n !== entry.servings) {
            update.mutate({ id: entry.id, servings: n });
          }
        }}
        className="w-14 rounded-md border border-border bg-surface px-1 py-0.5 text-center text-xs"
        aria-label="Servings"
      />
      <span className="w-14 text-right text-sm">{Math.round(entry.macros.calories)}</span>
      <button
        onClick={() => remove.mutate(entry.id)}
        className="text-faint hover:text-danger"
        aria-label="Remove entry"
      >
        ✕
      </button>
    </li>
  );
}

export default function FoodLog() {
  const [date, setDate] = useState(todayISO());
  const [addingTo, setAddingTo] = useState<Meal | null>(null);
  const { data: day } = useDayLog(date);
  const { data: user } = useMe();
  const { copy } = useLogMutations();
  const s = user?.settings;

  const isToday = date === todayISO();
  const dateLabel = isToday
    ? "Today"
    : new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

  const totals: MacroTotals = day?.totals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const remaining =
    s?.calorieTarget != null && s.calorieTarget > 0
      ? Math.round(s.calorieTarget - totals.calories)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setDate(shiftDate(date, -1))}>
          ‹
        </Button>
        <div className="text-center">
          <h1 className="text-xl font-bold">{dateLabel}</h1>
          {!isToday && (
            <button className="text-xs text-accent" onClick={() => setDate(todayISO())}>
              Jump to today
            </button>
          )}
        </div>
        <Button variant="ghost" onClick={() => setDate(shiftDate(date, 1))}>
          ›
        </Button>
      </div>

      <Card>
        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold">{Math.round(totals.calories)}</span>
          <span className="text-sm text-muted">
            {s?.calorieTarget != null && s.calorieTarget > 0
              ? `/ ${s.calorieTarget} cal`
              : "cal"}
          </span>
          {remaining != null && (
            <span
              className={`ml-auto text-sm font-medium ${
                remaining < 0 ? "text-danger" : "text-success"
              }`}
            >
              {remaining < 0 ? `${-remaining} over` : `${remaining} left`}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MacroBar
            label="Calories"
            value={totals.calories}
            target={s?.calorieTarget ?? null}
            color="bg-accent"
            unit=""
          />
          <MacroBar
            label="Protein"
            value={totals.protein}
            target={s?.proteinTarget ?? null}
            color="bg-accent"
          />
          <MacroBar
            label="Carbs"
            value={totals.carbs}
            target={s?.carbsTarget ?? null}
            color="bg-accent-2"
          />
          <MacroBar
            label="Fat"
            value={totals.fat}
            target={s?.fatTarget ?? null}
            color="bg-accent-3"
          />
        </div>
        {(s?.calorieTarget ?? null) == null && (
          <p className="mt-2 text-xs text-faint">
            Set daily targets in{" "}
            <Link to="/settings" className="text-accent">
              Settings
            </Link>{" "}
            to see progress bars.
          </p>
        )}
      </Card>

      {meals.map((meal) => {
        const entries = day?.entries.filter((e) => e.meal === meal) ?? [];
        const mealTotals = day?.meals[meal];
        return (
          <Card key={meal}>
            <div className="flex items-baseline gap-2">
              <h2 className="font-semibold">{mealLabels[meal]}</h2>
              {mealTotals && mealTotals.calories > 0 && (
                <span className="text-sm text-muted">
                  {Math.round(mealTotals.calories)} cal
                </span>
              )}
              <button
                onClick={() => setAddingTo(addingTo === meal ? null : meal)}
                className="ml-auto text-sm font-medium text-accent hover:brightness-110"
              >
                {addingTo === meal ? "Close" : "+ Add"}
              </button>
            </div>
            {entries.length > 0 && (
              <ul className="mt-1 divide-y divide-border">
                {entries.map((e) => (
                  <EntryRow key={e.id} entry={e} />
                ))}
              </ul>
            )}
            {addingTo === meal && (
              <AddFoodPanel date={date} meal={meal} onDone={() => setAddingTo(null)} />
            )}
          </Card>
        );
      })}

      <Button
        variant="ghost"
        onClick={() =>
          copy.mutate(
            { fromDate: shiftDate(date, -1), toDate: date },
            {
              onError: () => window.alert("Nothing logged yesterday to copy."),
            },
          )
        }
      >
        Copy everything from yesterday
      </Button>
    </div>
  );
}

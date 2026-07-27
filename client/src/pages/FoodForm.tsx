import { lazy, Suspense, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

const BarcodeScanner = lazy(() => import("../components/BarcodeScanner"));
import { Button, Card, ErrorText, Field, Input } from "../components/ui";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import {
  useFoodMutations,
  useLogMutations,
  useLookup,
  type Food,
  type LookupResult,
  type Meal,
} from "../lib/foods";

function NumberField({
  label,
  value,
  onChange,
  required,
  step = "0.1",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  step?: string;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
      />
    </Field>
  );
}

function LookupPanel({ onPick }: { onPick: (r: LookupResult) => void }) {
  const lookup = useLookup();
  const [q, setQ] = useState("");
  const [barcode, setBarcode] = useState("");
  const [scanning, setScanning] = useState(false);

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
        Look up nutrition (Open Food Facts)
      </p>
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Product name…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-40 flex-1"
        />
        <Input
          placeholder="or barcode"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          className="w-36"
        />
        <Button type="button" variant="ghost" onClick={() => setScanning(true)}>
          📷 Scan
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={lookup.isPending || (q.trim() === "" && barcode.trim() === "")}
          onClick={() =>
            lookup.mutate(
              barcode.trim() !== "" ? { barcode: barcode.trim() } : { q: q.trim() },
            )
          }
        >
          {lookup.isPending ? "Searching…" : "Search"}
        </Button>
      </div>
      {scanning && (
        <Suspense fallback={null}>
          <BarcodeScanner
            onDetected={(code) => {
              setScanning(false);
              setBarcode(code);
              lookup.mutate({ barcode: code });
            }}
            onClose={() => setScanning(false)}
          />
        </Suspense>
      )}
      {lookup.error && <ErrorText>{lookup.error.message}</ErrorText>}
      {lookup.data && (
        <ul className="mt-2 max-h-48 divide-y divide-border overflow-y-auto">
          {lookup.data.results.map((r, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onPick(r)}
                className="w-full px-2 py-1.5 text-left text-sm hover:bg-surface-2"
              >
                <span className="font-medium">{r.name}</span>
                {r.brand && <span className="text-faint"> — {r.brand}</span>}
                <span className="block text-xs text-muted">
                  per {r.servingSize} {r.servingUnit}: {r.calories ?? "?"} cal · P
                  {r.protein ?? "?"} C{r.carbs ?? "?"} F{r.fat ?? "?"}
                </span>
              </button>
            </li>
          ))}
          {lookup.data.results.length === 0 && (
            <li className="py-2 text-sm text-faint">No matches found.</li>
          )}
        </ul>
      )}
      <p className="mt-2 text-xs text-faint">
        Values import per serving when the product declares one, otherwise per
        100g. Lookup needs internet; everything else works offline.
      </p>
    </div>
  );
}

export default function FoodForm() {
  const { id } = useParams();
  const editing = id != null;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = params.get("returnTo"); // "YYYY-MM-DD:meal" — log after create
  const { create, update } = useFoodMutations();
  const { add: addLogEntry } = useLogMutations();

  // For editing we fetch the food from the list cache via search API.
  const existing = useQuery({
    queryKey: ["foods", "one", id],
    queryFn: async () => {
      const { foods } = await api.get<{ foods: Food[] }>("/api/foods");
      const food = foods.find((f) => f.id === Number(id));
      if (!food) throw new Error("Food not found");
      return food;
    },
    enabled: editing,
  });

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [barcode, setBarcode] = useState("");
  const [servingSize, setServingSize] = useState("1");
  const [servingUnit, setServingUnit] = useState("serving");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [fiber, setFiber] = useState("");
  const [sugar, setSugar] = useState("");
  const [sodium, setSodium] = useState("");
  const [initialized, setInitialized] = useState(!editing);

  const food = existing.data;
  if (editing && food && !initialized) {
    setName(food.name);
    setBrand(food.brand ?? "");
    setBarcode(food.barcode ?? "");
    setServingSize(String(food.servingSize));
    setServingUnit(food.servingUnit);
    setCalories(String(food.calories));
    setProtein(String(food.protein));
    setCarbs(String(food.carbs));
    setFat(String(food.fat));
    setFiber(food.fiber != null ? String(food.fiber) : "");
    setSugar(food.sugar != null ? String(food.sugar) : "");
    setSodium(food.sodium != null ? String(food.sodium) : "");
    setInitialized(true);
  }

  function importLookup(r: LookupResult) {
    setName(r.name);
    if (r.brand) setBrand(r.brand);
    if (r.barcode) setBarcode(r.barcode);
    setServingSize(String(r.servingSize));
    setServingUnit(r.servingUnit);
    if (r.calories != null) setCalories(String(r.calories));
    if (r.protein != null) setProtein(String(r.protein));
    if (r.carbs != null) setCarbs(String(r.carbs));
    if (r.fat != null) setFat(String(r.fat));
    if (r.fiber != null) setFiber(String(r.fiber));
    if (r.sugar != null) setSugar(String(r.sugar));
    if (r.sodium != null) setSodium(String(r.sodium));
  }

  const mutation = editing ? update : create;

  function submit(e: FormEvent) {
    e.preventDefault();
    const num = (v: string) => (v.trim() === "" ? undefined : Number(v));
    const optional = (v: string) => (v.trim() === "" ? null : Number(v));
    const input = {
      name: name.trim(),
      brand: brand.trim() || null,
      barcode: barcode.trim() || null,
      servingSize: num(servingSize) ?? 1,
      servingUnit: servingUnit.trim() || "serving",
      calories: num(calories) ?? 0,
      protein: num(protein) ?? 0,
      carbs: num(carbs) ?? 0,
      fat: num(fat) ?? 0,
      fiber: optional(fiber),
      sugar: optional(sugar),
      sodium: optional(sodium),
    };
    if (editing) {
      update.mutate({ id: Number(id), ...input }, { onSuccess: () => navigate("/food/foods") });
    } else {
      create.mutate(input, {
        onSuccess: (data) => {
          if (returnTo) {
            const [date, meal] = returnTo.split(":");
            addLogEntry.mutate(
              { foodId: data.food.id, date: date!, meal: meal as Meal, servings: 1 },
              { onSuccess: () => navigate("/food/log") },
            );
          } else {
            navigate("/food/foods");
          }
        },
      });
    }
  }

  if (editing && existing.isLoading) {
    return <p className="py-12 text-center text-muted">Loading…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/food/foods" className="text-sm text-muted hover:text-fg">
        ← Back to foods
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-bold">
        {editing ? "Edit food" : "New food"}
      </h1>

      {!editing && <div className="mb-4"><LookupPanel onPick={importLookup} /></div>}

      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Brand (optional)">
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <NumberField label="Serving size" value={servingSize} onChange={setServingSize} required />
            <Field label="Unit">
              <Input
                value={servingUnit}
                onChange={(e) => setServingUnit(e.target.value)}
                placeholder="g, cup, slice…"
                required
              />
            </Field>
            <Field label="Barcode (optional)">
              <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <NumberField label="Calories" value={calories} onChange={setCalories} required />
            <NumberField label="Protein (g)" value={protein} onChange={setProtein} />
            <NumberField label="Carbs (g)" value={carbs} onChange={setCarbs} />
            <NumberField label="Fat (g)" value={fat} onChange={setFat} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <NumberField label="Fiber (g, opt.)" value={fiber} onChange={setFiber} />
            <NumberField label="Sugar (g, opt.)" value={sugar} onChange={setSugar} />
            <NumberField label="Sodium (mg, opt.)" value={sodium} onChange={setSodium} step="1" />
          </div>
          <ErrorText>{mutation.error?.message}</ErrorText>
          <div className="flex gap-3">
            <Button type="submit" disabled={mutation.isPending}>
              {editing ? "Save changes" : returnTo ? "Create & log it" : "Create food"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

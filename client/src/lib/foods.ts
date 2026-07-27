import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export type Food = {
  id: number;
  userId: number;
  name: string;
  brand: string | null;
  barcode: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
  isDeleted: boolean;
};

export type FoodInput = Omit<Food, "id" | "userId" | "isDeleted">;

export type Meal = "breakfast" | "lunch" | "dinner" | "snack";
export const meals: Meal[] = ["breakfast", "lunch", "dinner", "snack"];
export const mealLabels: Record<Meal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snacks",
};

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type LogEntry = {
  id: number;
  foodId: number;
  date: string;
  meal: Meal;
  servings: number;
  food: Food;
  macros: MacroTotals;
};

export type DayLog = {
  date: string;
  entries: LogEntry[];
  meals: Record<Meal, MacroTotals>;
  totals: MacroTotals;
};

export type LookupResult = {
  name: string;
  brand: string | null;
  barcode: string | null;
  // Nutrition basis: one serving of servingSize servingUnit.
  servingSize: number;
  servingUnit: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
};

export function useFoods(search: string) {
  return useQuery({
    queryKey: ["foods", "list", search],
    queryFn: () =>
      api.get<{ foods: Food[] }>(`/api/foods?search=${encodeURIComponent(search)}`),
    placeholderData: (prev) => prev,
  });
}

export function useRecentFoods() {
  return useQuery({
    queryKey: ["foods", "recent"],
    queryFn: () => api.get<{ foods: Food[] }>("/api/foods/recent"),
  });
}

export function useDayLog(date: string) {
  return useQuery({
    queryKey: ["food-log", date],
    queryFn: () => api.get<DayLog>(`/api/food-log/day/${date}`),
  });
}

export function useFoodMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["foods"] });
  const create = useMutation({
    mutationFn: (input: Partial<FoodInput>) => api.post<{ food: Food }>("/api/foods", input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: ({ id, ...input }: Partial<FoodInput> & { id: number }) =>
      api.patch<{ food: Food }>(`/api/foods/${id}`, input),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete<{ ok: boolean }>(`/api/foods/${id}`),
    onSuccess: invalidate,
  });
  return { create, update, remove };
}

export function useLogMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["food-log"] });
    qc.invalidateQueries({ queryKey: ["foods", "recent"] });
  };
  const add = useMutation({
    mutationFn: (input: { foodId: number; date: string; meal: Meal; servings: number }) =>
      api.post<{ entry: LogEntry }>("/api/food-log", input),
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: (input: { id: number; servings?: number; meal?: Meal }) => {
      const { id, ...body } = input;
      return api.patch<{ entry: LogEntry }>(`/api/food-log/${id}`, body);
    },
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api.delete<{ ok: boolean }>(`/api/food-log/${id}`),
    onSuccess: invalidate,
  });
  const copy = useMutation({
    mutationFn: (input: { fromDate: string; toDate: string; meal?: Meal }) =>
      api.post<{ copied: number }>("/api/food-log/copy", input),
    onSuccess: invalidate,
  });
  return { add, update, remove, copy };
}

export function useLookup() {
  return useMutation({
    mutationFn: (input: { q?: string; barcode?: string }) => {
      const params = new URLSearchParams();
      if (input.q) params.set("q", input.q);
      if (input.barcode) params.set("barcode", input.barcode);
      return api.get<{ results: LookupResult[] }>(`/api/lookup/off?${params}`);
    },
  });
}

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

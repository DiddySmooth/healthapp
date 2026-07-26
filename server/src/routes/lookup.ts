import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import type { Db } from "../db/index.js";
import { ApiError, asyncHandler } from "../lib/errors.js";

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

const OFF_BASE = "https://world.openfoodfacts.org";
const TIMEOUT_MS = 5000;

export type LookupResult = {
  name: string;
  brand: string | null;
  barcode: string | null;
  // Per 100g/100ml as reported by Open Food Facts.
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapProduct(p: any): LookupResult | null {
  const n = p?.nutriments;
  if (!p?.product_name && !p?.generic_name) return null;
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
  return {
    name: String(p.product_name || p.generic_name),
    brand: p.brands ? String(p.brands).split(",")[0]!.trim() : null,
    barcode: p.code ? String(p.code) : null,
    calories: num(n?.["energy-kcal_100g"]),
    protein: num(n?.proteins_100g),
    carbs: num(n?.carbohydrates_100g),
    fat: num(n?.fat_100g),
    fiber: num(n?.fiber_100g),
    sugar: num(n?.sugars_100g),
    sodium: num(n?.sodium_100g != null ? n.sodium_100g * 1000 : null), // g → mg
  };
}

async function offFetch(fetchImpl: FetchLike, url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) {
      throw new ApiError(502, "LOOKUP_FAILED", "Food database returned an error");
    }
    return await res.json();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(
      503,
      "LOOKUP_UNAVAILABLE",
      "Food lookup is unavailable — enter the details manually",
    );
  } finally {
    clearTimeout(timer);
  }
}

export function lookupRoutes(db: Db, fetchImpl: FetchLike = fetch): Router {
  const router = Router();
  router.use(requireAuth(db));

  router.get(
    "/off",
    asyncHandler(async (req, res) => {
      const barcode = String(req.query.barcode ?? "").trim();
      const q = String(req.query.q ?? "").trim();

      if (barcode) {
        const data: any = await offFetch(
          fetchImpl,
          `${OFF_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json`,
        );
        if (data?.status !== 1 || !data.product) {
          res.json({ results: [] });
          return;
        }
        const mapped = mapProduct(data.product);
        res.json({ results: mapped ? [mapped] : [] });
        return;
      }

      if (!q) {
        throw new ApiError(400, "VALIDATION", "Provide q or barcode");
      }
      const data: any = await offFetch(
        fetchImpl,
        `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=10&fields=code,product_name,generic_name,brands,nutriments`,
      );
      const products: any[] = Array.isArray(data?.products) ? data.products : [];
      res.json({
        results: products.map(mapProduct).filter((r): r is LookupResult => r != null),
      });
    }),
  );

  return router;
}

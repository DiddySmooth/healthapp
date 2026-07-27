import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import type { Db } from "../db/index.js";
import { ApiError, asyncHandler } from "../lib/errors.js";

export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

// Modern search API (the legacy cgi/search.pl endpoint serves an HTML block
// page); barcode lookups still live on the main API host.
const OFF_SEARCH_BASE = "https://search.openfoodfacts.org";
const OFF_PRODUCT_BASE = "https://world.openfoodfacts.org";
const OFF_FIELDS =
  "code,product_name,generic_name,brands,nutriments,serving_quantity,serving_quantity_unit";
// Open Food Facts asks API users to identify themselves.
const USER_AGENT = "HealthApp/0.1 (self-hosted; +https://github.com/DiddySmooth/healthapp)";
const TIMEOUT_MS = 5000;

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

/* eslint-disable @typescript-eslint/no-explicit-any */
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v * 10) / 10 : null;
}

function mapProduct(p: any): LookupResult | null {
  const n = p?.nutriments;
  if (!p?.product_name && !p?.generic_name) return null;
  const brandRaw = Array.isArray(p.brands) ? p.brands[0] : p.brands;

  // Prefer real per-serving data ("1 Babybel, 20 g") over the per-100g basis.
  const servingQty = num(
    typeof p.serving_quantity === "string" ? Number(p.serving_quantity) : p.serving_quantity,
  );
  const perServing = servingQty != null && servingQty > 0 && n?.["energy-kcal_serving"] != null;
  const suffix = perServing ? "_serving" : "_100g";

  return {
    name: String(p.product_name || p.generic_name),
    brand: brandRaw ? String(brandRaw).split(",")[0]!.trim() : null,
    barcode: p.code ? String(p.code) : null,
    servingSize: perServing ? servingQty! : 100,
    servingUnit: perServing ? String(p.serving_quantity_unit || "g") : "g",
    calories: num(n?.[`energy-kcal${suffix}`]),
    protein: num(n?.[`proteins${suffix}`]),
    carbs: num(n?.[`carbohydrates${suffix}`]),
    fat: num(n?.[`fat${suffix}`]),
    fiber: num(n?.[`fiber${suffix}`]),
    sugar: num(n?.[`sugars${suffix}`]),
    sodium: num(n?.[`sodium${suffix}`] != null ? n[`sodium${suffix}`] * 1000 : null), // g → mg
  };
}

async function offFetch(fetchImpl: FetchLike, url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { "User-Agent": USER_AGENT },
    });
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
          `${OFF_PRODUCT_BASE}/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${OFF_FIELDS}`,
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
        `${OFF_SEARCH_BASE}/search?q=${encodeURIComponent(q)}&page_size=10&fields=${OFF_FIELDS}`,
      );
      const products: any[] = Array.isArray(data?.hits) ? data.hits : [];
      res.json({
        results: products.map(mapProduct).filter((r): r is LookupResult => r != null),
      });
    }),
  );

  return router;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

// The web app talks to its own origin with the session cookie (the
// defaults). The native app points baseUrl at the user's server and
// authenticates with a bearer token.
type ApiConfig = {
  baseUrl: string;
  getToken: () => string | null;
  onUnauthorized?: () => void;
};

const config: ApiConfig = { baseUrl: "", getToken: () => null };

export function configureApi(patch: Partial<ApiConfig>): void {
  Object.assign(config, patch);
}

// Server-relative paths (exercise images) resolved against the server.
export function assetUrl(path: string): string {
  return /^https?:/.test(path) ? path : config.baseUrl + path;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = config.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(config.baseUrl + url, {
    method,
    credentials: "same-origin",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && token) config.onUnauthorized?.();
  if (!res.ok) {
    let code = "UNKNOWN";
    let message = res.statusText;
    try {
      const data = await res.json();
      code = data?.error?.code ?? code;
      message = data?.error?.message ?? message;
    } catch {
      // non-JSON error body; keep statusText
    }
    throw new ApiError(res.status, code, message);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(url: string) => request<T>("GET", url),
  post: <T>(url: string, body?: unknown) => request<T>("POST", url, body),
  patch: <T>(url: string, body?: unknown) => request<T>("PATCH", url, body),
  put: <T>(url: string, body?: unknown) => request<T>("PUT", url, body),
  delete: <T>(url: string) => request<T>("DELETE", url),
};

export type UserSettings = {
  weightUnit: "lbs" | "kg";
  distanceUnit: "mi" | "km";
  timezone: string;
  weekStart: "monday" | "sunday";
  calorieTarget: number | null;
  proteinTarget: number | null;
  carbsTarget: number | null;
  fatTarget: number | null;
  waterTargetMl: number | null;
};

export type User = {
  id: number;
  username: string;
  role: "admin" | "user";
  isActive: boolean;
  settings: UserSettings;
  createdAt: string;
};

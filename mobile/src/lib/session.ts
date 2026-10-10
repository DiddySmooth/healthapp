import { configureApi, type User } from "@healthapp/shared";
import * as SecureStore from "expo-secure-store";
import { useSyncExternalStore } from "react";

// Which server we talk to and the bearer token for it. Persisted in the
// Keychain/Keystore; mirrored into the shared API client on every change.
export type AuthState =
  | { status: "loading" }
  | { status: "signedOut"; serverUrl: string | null }
  | { status: "signedIn"; serverUrl: string; token: string };

const SERVER_KEY = "serverUrl";
const TOKEN_KEY = "authToken";

let state: AuthState = { status: "loading" };
const listeners = new Set<() => void>();

function setState(next: AuthState) {
  state = next;
  configureApi({
    baseUrl: next.status === "signedIn" ? next.serverUrl : "",
    getToken: () => (state.status === "signedIn" ? state.token : null),
    onUnauthorized: () => void signOut({ revoke: false }),
  });
  listeners.forEach((l) => l());
}

export function useAuth(): AuthState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export async function loadSession(): Promise<void> {
  const [serverUrl, token] = await Promise.all([
    SecureStore.getItemAsync(SERVER_KEY),
    SecureStore.getItemAsync(TOKEN_KEY),
  ]);
  setState(
    serverUrl && token
      ? { status: "signedIn", serverUrl, token }
      : { status: "signedOut", serverUrl },
  );
}

// Accepts "192.168.1.5:3420", "health.example.com", or a full URL.
export function normalizeServerUrl(input: string): string {
  let url = input.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(url)) url = `http://${url}`;
  return url;
}

export class SignInError extends Error {}

export async function signIn(input: {
  serverUrl: string;
  username: string;
  password: string;
  deviceName: string;
}): Promise<User> {
  const serverUrl = normalizeServerUrl(input.serverUrl);
  let res: Response;
  try {
    res = await fetch(`${serverUrl}/api/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: input.username,
        password: input.password,
        deviceName: input.deviceName,
      }),
    });
  } catch {
    throw new SignInError(`Couldn't reach ${serverUrl}. Check the address and your network.`);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 404) {
      throw new SignInError("That server doesn't support the app yet — update HealthApp.");
    }
    throw new SignInError(data?.error?.message ?? `Sign-in failed (${res.status})`);
  }
  await SecureStore.setItemAsync(SERVER_KEY, serverUrl);
  await SecureStore.setItemAsync(TOKEN_KEY, data.token);
  setState({ status: "signedIn", serverUrl, token: data.token });
  return data.user as User;
}

export async function signOut({ revoke = true } = {}): Promise<void> {
  if (state.status !== "signedIn") return;
  const { serverUrl, token } = state;
  if (revoke) {
    // Best effort: a dead server shouldn't keep you signed in.
    fetch(`${serverUrl}/api/auth/token`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  setState({ status: "signedOut", serverUrl });
}

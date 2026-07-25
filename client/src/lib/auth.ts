import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type User, type UserSettings } from "./api";

export function useAuthStatus() {
  return useQuery({
    queryKey: ["auth", "status"],
    queryFn: () => api.get<{ needsSetup: boolean }>("/api/auth/status"),
    staleTime: Infinity,
  });
}

export function useMe() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async (): Promise<User | null> => {
      try {
        const { user } = await api.get<{ user: User }>("/api/auth/me");
        return user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

function useAuthInvalidation() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["auth"] });
}

export function useSetup() {
  const invalidate = useAuthInvalidation();
  return useMutation({
    mutationFn: (input: {
      username: string;
      password: string;
      settings?: Partial<UserSettings>;
    }) => api.post<{ user: User }>("/api/auth/setup", input),
    onSuccess: invalidate,
  });
}

export function useLogin() {
  const invalidate = useAuthInvalidation();
  return useMutation({
    mutationFn: (input: { username: string; password: string }) =>
      api.post<{ user: User }>("/api/auth/login", input),
    onSuccess: invalidate,
  });
}

export function useLogout() {
  const invalidate = useAuthInvalidation();
  return useMutation({
    mutationFn: () => api.post<{ ok: boolean }>("/api/auth/logout"),
    onSuccess: invalidate,
  });
}

export function useUpdateSettings() {
  const invalidate = useAuthInvalidation();
  return useMutation({
    mutationFn: (patch: Partial<UserSettings>) =>
      api.patch<{ user: User }>("/api/auth/me/settings", patch),
    onSuccess: invalidate,
  });
}

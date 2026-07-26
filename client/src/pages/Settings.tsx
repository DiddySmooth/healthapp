import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button, Card, ErrorText, Field, Input, Select } from "../components/ui";
import { api, type User, type UserSettings } from "../lib/api";
import { useMe, useUpdateSettings } from "../lib/auth";

const timezones: string[] =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["UTC"];

function MySettings({ user }: { user: User }) {
  const update = useUpdateSettings();
  const s = user.settings;

  function set<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    update.mutate({ [key]: value });
  }

  return (
    <Card title="Preferences">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Weight unit">
          <Select
            value={s.weightUnit}
            onChange={(e) => set("weightUnit", e.target.value as "lbs" | "kg")}
          >
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </Select>
        </Field>
        <Field label="Distance unit">
          <Select
            value={s.distanceUnit}
            onChange={(e) => set("distanceUnit", e.target.value as "mi" | "km")}
          >
            <option value="mi">miles</option>
            <option value="km">kilometers</option>
          </Select>
        </Field>
        <Field label="Week starts on">
          <Select
            value={s.weekStart}
            onChange={(e) => set("weekStart", e.target.value as "monday" | "sunday")}
          >
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </Select>
        </Field>
        <Field label="Timezone">
          <Select value={s.timezone} onChange={(e) => set("timezone", e.target.value)}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <ErrorText>{update.error?.message}</ErrorText>
    </Card>
  );
}

function TargetInput({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number | null;
  onSave: (v: number | null) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        defaultValue={value ?? ""}
        key={String(value)}
        placeholder="not set"
        onBlur={(e) => {
          const raw = e.target.value.trim();
          const next = raw === "" ? null : Number(raw);
          if (next !== value && (next == null || Number.isFinite(next))) onSave(next);
        }}
      />
    </Field>
  );
}

function NutritionTargets({ user }: { user: User }) {
  const update = useUpdateSettings();
  const s = user.settings;
  return (
    <Card title="Daily nutrition targets">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <TargetInput
          label="Calories"
          value={s.calorieTarget}
          onSave={(v) => update.mutate({ calorieTarget: v })}
        />
        <TargetInput
          label="Protein (g)"
          value={s.proteinTarget}
          onSave={(v) => update.mutate({ proteinTarget: v })}
        />
        <TargetInput
          label="Carbs (g)"
          value={s.carbsTarget}
          onSave={(v) => update.mutate({ carbsTarget: v })}
        />
        <TargetInput
          label="Fat (g)"
          value={s.fatTarget}
          onSave={(v) => update.mutate({ fatTarget: v })}
        />
        <TargetInput
          label="Water (ml)"
          value={s.waterTargetMl}
          onSave={(v) => update.mutate({ waterTargetMl: v })}
        />
      </div>
      <p className="mt-2 text-xs text-faint">
        Leave a field empty to clear the target. Saved when you leave the field.
      </p>
      <ErrorText>{update.error?.message}</ErrorText>
    </Card>
  );
}

function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState("");
  const change = useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api.post<{ ok: boolean }>("/api/auth/password", input),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setLocalError("");
    if (next !== confirm) {
      setLocalError("New passwords do not match");
      return;
    }
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          setCurrent("");
          setNext("");
          setConfirm("");
        },
      },
    );
  }

  return (
    <Card title="Change password">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-3 sm:items-end">
        <Field label="Current password">
          <Input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </Field>
        <Field label="New password">
          <Input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </Field>
        <Field label="Confirm new password">
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </Field>
        <div className="sm:col-span-3">
          <ErrorText>{localError || change.error?.message}</ErrorText>
          {change.isSuccess && !localError && (
            <p className="text-sm text-success">Password updated.</p>
          )}
          <Button type="submit" disabled={change.isPending} className="mt-1">
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function AdminBackup() {
  return (
    <Card title="Backup">
      <p className="mb-3 text-sm text-muted">
        Download a snapshot of the entire database (all users). You can also back up
        by copying the mounted <code className="text-fg">/data</code> folder.
      </p>
      <a href="/api/admin/backup" download>
        <Button variant="ghost">Download database backup</Button>
      </a>
    </Card>
  );
}

function AdminUsers() {
  const qc = useQueryClient();
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<{ users: User[] }>("/api/users"),
  });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["users"] });

  const createUser = useMutation({
    mutationFn: (input: { username: string; password: string }) =>
      api.post<{ user: User }>("/api/users", input),
    onSuccess: invalidate,
  });
  const patchUser = useMutation({
    mutationFn: ({ id, ...patch }: { id: number; isActive?: boolean; password?: string }) =>
      api.patch<{ user: User }>(`/api/users/${id}`, patch),
    onSuccess: invalidate,
  });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function addUser(e: FormEvent) {
    e.preventDefault();
    createUser.mutate(
      { username, password },
      {
        onSuccess: () => {
          setUsername("");
          setPassword("");
        },
      },
    );
  }

  function resetPassword(user: User) {
    const next = window.prompt(`New password for ${user.username} (min 8 chars):`);
    if (next) patchUser.mutate({ id: user.id, password: next });
  }

  return (
    <Card title="Users">
      <ul className="mb-4 divide-y divide-border">
        {usersQuery.data?.users.map((u) => (
          <li key={u.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className={u.isActive ? "" : "line-through opacity-50"}>
              {u.username}
            </span>
            {u.role === "admin" && (
              <span className="rounded bg-accent-2/20 px-1.5 py-0.5 text-xs text-accent-2">
                admin
              </span>
            )}
            <span className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={() => resetPassword(u)}>
                Reset password
              </Button>
              <Button
                variant={u.isActive ? "danger" : "ghost"}
                onClick={() => patchUser.mutate({ id: u.id, isActive: !u.isActive })}
              >
                {u.isActive ? "Deactivate" : "Reactivate"}
              </Button>
            </span>
          </li>
        ))}
      </ul>

      <form onSubmit={addUser} className="flex flex-wrap items-end gap-3">
        <Field label="New username">
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3}
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </Field>
        <Button type="submit" disabled={createUser.isPending}>
          Add user
        </Button>
      </form>
      <ErrorText>{createUser.error?.message || patchUser.error?.message}</ErrorText>
    </Card>
  );
}

export default function Settings() {
  const { data: user } = useMe();
  if (!user) return null;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <MySettings user={user} />
      <NutritionTargets user={user} />
      <ChangePassword />
      {user.role === "admin" && <AdminUsers />}
      {user.role === "admin" && <AdminBackup />}
    </div>
  );
}

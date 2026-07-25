import { useState, type FormEvent } from "react";
import { useSetup } from "../lib/auth";
import { Button, Card, ErrorText, Field, Input, Select } from "../components/ui";

const timezones: string[] =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["UTC"];

const guessedTz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

export default function SetupWizard() {
  const setup = useSetup();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [weightUnit, setWeightUnit] = useState<"lbs" | "kg">("lbs");
  const [distanceUnit, setDistanceUnit] = useState<"mi" | "km">("mi");
  const [timezone, setTimezone] = useState(guessedTz);
  const [localError, setLocalError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    setLocalError("");
    if (password !== confirm) {
      setLocalError("Passwords do not match");
      return;
    }
    setup.mutate({
      username,
      password,
      settings: { weightUnit, distanceUnit, timezone },
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-center text-3xl font-bold">
          Health<span className="text-accent">App</span>
        </h1>
        <p className="mb-6 text-center text-muted">
          Welcome! Let&apos;s create your admin account.
        </p>
        <Card>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Username">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                minLength={3}
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </Field>
            <Field label="Confirm password">
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Weight unit">
                <Select
                  value={weightUnit}
                  onChange={(e) => setWeightUnit(e.target.value as "lbs" | "kg")}
                >
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </Select>
              </Field>
              <Field label="Distance unit">
                <Select
                  value={distanceUnit}
                  onChange={(e) => setDistanceUnit(e.target.value as "mi" | "km")}
                >
                  <option value="mi">miles</option>
                  <option value="km">kilometers</option>
                </Select>
              </Field>
            </div>
            <Field label="Timezone">
              <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </Field>
            <ErrorText>{localError || setup.error?.message}</ErrorText>
            <Button type="submit" disabled={setup.isPending}>
              {setup.isPending ? "Creating…" : "Create admin account"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

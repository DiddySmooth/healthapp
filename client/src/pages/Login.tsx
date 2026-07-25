import { useState, type FormEvent } from "react";
import { useLogin } from "../lib/auth";
import { Button, Card, ErrorText, Field, Input } from "../components/ui";

export default function Login() {
  const login = useLogin();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    login.mutate({ username, password });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-3xl font-bold">
          Health<span className="text-accent">App</span>
        </h1>
        <Card>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <Field label="Username">
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>
            <ErrorText>{login.error?.message}</ErrorText>
            <Button type="submit" disabled={login.isPending}>
              {login.isPending ? "Logging in…" : "Log in"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}

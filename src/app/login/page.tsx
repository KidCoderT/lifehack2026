"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div>
        <Sprout className="size-11 text-canopy" strokeWidth={1.75} />
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Evergreen</h1>
        <p className="mt-2 text-muted">Your community garden is waiting.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@u.nus.edu"
          className="rounded-2xl border border-border bg-surface px-5 py-4 text-base outline-none ring-primary focus:ring-2"
        />
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          className="rounded-2xl border border-border bg-surface px-5 py-4 text-base outline-none ring-primary focus:ring-2"
        />
        {error && <p className="text-sm text-flag">{error}</p>}
        <Button type="submit" disabled={busy} className="mt-2 px-5 py-4 text-lg">
          {busy ? "Checking…" : "Let's grow"}
        </Button>
      </form>
      <p className="text-center text-xs text-muted">
        Accounts are issued by your organization.
      </p>
    </main>
  );
}

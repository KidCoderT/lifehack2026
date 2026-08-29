"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
        <p className="text-5xl">🌱</p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-zinc-400">Your planet streak is waiting.</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="rounded-2xl bg-zinc-900 px-5 py-4 text-lg outline-none ring-lime-400 focus:ring-2"
        />
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          className="rounded-2xl bg-zinc-900 px-5 py-4 text-lg outline-none ring-lime-400 focus:ring-2"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-2xl bg-lime-400 px-5 py-4 text-lg font-semibold text-black active:scale-[.98] disabled:opacity-50"
        >
          {busy ? "Checking…" : "Let's go"}
        </button>
      </form>
    </main>
  );
}

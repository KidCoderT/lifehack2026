"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toJpeg } from "@/lib/image";


export default function ProfileForm({
  userId,
  initialUsername = "",
  initialAvatarUrl = null,
  submitLabel = "Save",
  redirectTo = "/",
}: {
  userId: string;
  initialUsername?: string;
  initialAvatarUrl?: string | null;
  submitLabel?: string;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initialAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const username = String(new FormData(e.currentTarget).get("username")).trim();

    let avatar_url: string | null = null;
    if (file) {
      const path = `${userId}/avatar.jpg`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, await toJpeg(file, 256, true), { upsert: true, contentType: "image/jpeg" });
      if (error) {
        setError(`Photo upload failed: ${error.message}`);
        setBusy(false);
        return;
      }
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      // ponytail: cache-bust so a re-upload isn't hidden behind the CDN copy.
      avatar_url = `${data.publicUrl}?v=${Date.now()}`;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ username, ...(avatar_url && { avatar_url }) })
      .eq("id", userId)
      .select("id");

    if (error || !data?.length) {
      setError(
        error?.code === "23505"
          ? "That name is taken. Try another."
          : (error?.message ?? "No profile row for this account — run the seed script."),
      );
      setBusy(false);
      return;
    }
    router.replace(redirectTo);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="mx-auto cursor-pointer">
        <input type="file" accept="image/*" onChange={pick} className="hidden" />
        <span
          className="flex size-28 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-surface-muted bg-cover bg-center text-3xl"
          style={preview ? { backgroundImage: `url(${preview})` } : undefined}
        >
          {!preview && "📷"}
        </span>
      </label>

      <input
        name="username"
        required
        minLength={3}
        maxLength={20}
        autoComplete="off"
        defaultValue={initialUsername}
        placeholder="ecowarrior"
        className="rounded-2xl border border-border bg-surface px-5 py-4 text-base outline-none ring-primary focus:ring-2"
      />
      {error && <p className="text-sm text-flag">{error}</p>}
      <Button type="submit" disabled={busy} className="px-5 py-4 text-lg">
        {busy ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-encode to a 256px JPEG. Fixes two things at once: iOS hands over HEIC that
 * most browsers can't render, and phone photos are multi-megabyte for a 48px circle.
 */
async function toJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  canvas
    .getContext("2d")!
    .drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, 256, 256);
  return new Promise((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.85));
}

export default function ProfileForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
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
        .upload(path, await toJpeg(file), { upsert: true, contentType: "image/jpeg" });
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
    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="mx-auto cursor-pointer">
        <input type="file" accept="image/*" onChange={pick} className="hidden" />
        <span
          className="flex size-28 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-zinc-700 bg-zinc-900 bg-cover bg-center text-3xl"
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
        placeholder="ecowarrior"
        className="rounded-2xl bg-zinc-900 px-5 py-4 text-lg outline-none ring-lime-400 focus:ring-2"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-2xl bg-lime-400 px-5 py-4 text-lg font-semibold text-black active:scale-[.98] disabled:opacity-50"
      >
        {busy ? "Setting up…" : "Start growing"}
      </button>
    </form>
  );
}

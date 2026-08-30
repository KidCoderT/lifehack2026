"use client";

import { useRef, useState, useTransition } from "react";
import { Camera, Check, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toJpeg } from "@/lib/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { resolveAlert } from "@/app/(authed)/alerts/actions";

export type AlertRow = {
  id: number;
  message: string;
  status: "open" | "fixed" | "reported";
  photoUrl: string | null;
  resolvedByName: string | null;
  createdAt: string;
  /** `reported` is a half state: confirmed real, still broken, still fixable by someone else. */
  reportPhotoUrl?: string | null;
  reportedByName?: string | null;
  /** What the viewer already spent their one action on, if anything. */
  viewerAction?: "fixed" | "reported" | null;
};

const FIX_POINTS = 100;
const REPORT_PROVEN_POINTS = 50;
const REPORT_BARE_POINTS = 10;

export function AlertCard({ alert, userId }: { alert: AlertRow; userId: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ action: "fixed" | "reported"; points: number } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  // Only `fixed` settles a card. A reported alert is still broken, so it keeps the alarm icon.
  const fixed = alert.status === "fixed" || done?.action === "fixed";
  const acted = done?.action ?? alert.viewerAction ?? null;
  const canAct = !fixed && !acted;

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function send(action: "fixed" | "reported") {
    setError(null);
    startTransition(async () => {
      let photoUrl: string | null = null;

      if (file) {
        const supabase = createClient();
        const path = `${userId}/alert-${alert.id}.jpg`;
        try {
          // Reuses the `avatars` bucket: its write policy is scoped to
          // foldername(name)[1] = auth.uid(), so this path is already authorised and
          // needs no new bucket or migration. Note the bucket is public-read.
          const { error: upErr } = await supabase.storage
            .from("avatars")
            .upload(path, await toJpeg(file, 1024), { upsert: true, contentType: "image/jpeg" });
          if (upErr) {
            setError(`Photo upload failed: ${upErr.message}`);
            return;
          }
        } catch {
          // createImageBitmap throws on HEIC outside Safari — say so rather than dying quietly.
          setError("Couldn't read that photo. Try a JPEG or PNG.");
          return;
        }
        photoUrl = `${supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl}?v=${alert.id}`;
      }

      const res = await resolveAlert(alert.id, action, photoUrl);
      if (!res.ok) {
        setError(res.error ?? "That didn't go through.");
        return;
      }
      setDone({ action, points: res.points ?? 0 });
    });
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span
          className={`flex size-8 shrink-0 items-center justify-center rounded-[9px] ${
            fixed ? "bg-surface-muted text-muted" : "bg-surface-muted text-flag"
          }`}
        >
          {fixed ? <Check className="size-4" /> : <TriangleAlert className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] leading-snug font-semibold">{alert.message}</p>
          <p className="mt-1 text-[11.5px] tracking-[0.11em] text-muted uppercase">
            {new Date(alert.createdAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              // Locale and zone are pinned: an unpinned toLocaleDateString renders "30 Aug" on
              // the server and "Aug 30" in the browser, which fails hydration and makes React
              // regenerate the whole card — taking its click handlers with it.
              timeZone: "UTC",
            })}
          </p>
        </div>
      </div>

      {(preview || alert.photoUrl || alert.reportPhotoUrl) && (
        // eslint-disable-next-line @next/next/no-img-element -- same call as Avatar: avoids next/image remote-pattern config
        <img
          src={preview ?? alert.photoUrl ?? alert.reportPhotoUrl!}
          alt=""
          className="mt-3 max-h-48 w-full rounded-2xl border border-border object-cover"
        />
      )}

      {alert.status === "reported" && !fixed && (
        <p className="mt-3 text-[13px] text-muted">
          Reported{alert.reportedByName ? ` by ${alert.reportedByName}` : ""} — still running.
        </p>
      )}
      {fixed && !done && (
        <p className="mt-3 text-[13px] text-muted">
          Fixed{alert.resolvedByName ? ` by ${alert.resolvedByName}` : ""}.
        </p>
      )}

      {done ? (
        <p className="mt-3 text-[13px] font-semibold text-primary">
          Thanks — that&apos;s +{done.points} points on your next check of the wallet.
        </p>
      ) : acted ? (
        <p className="mt-3 text-[13px] text-muted">
          {acted === "fixed"
            ? "You fixed this one."
            : "Your report is in — someone else can still switch it off."}
        </p>
      ) : !canAct ? null : (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={pick}
            className="hidden"
          />
          <div className="mt-3 flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2"
            >
              <Camera className="size-4" strokeWidth={2} />
              {file ? "Retake photo" : "Add a photo"}
            </Button>
            <Button
              type="button"
              disabled={pending || !file}
              onClick={() => send("fixed")}
              className="w-full"
            >
              {pending ? "Sending…" : `I turned it off · +${FIX_POINTS}`}
            </Button>
            {/* Already reported by someone else: it is confirmed real, so the only thing
                left worth paying for is switching it off. */}
            {alert.status === "open" && (
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => send("reported")}
                className="w-full"
              >
                Can&apos;t fix it — report it · +
                {file ? REPORT_PROVEN_POINTS : REPORT_BARE_POINTS}
              </Button>
            )}
          </div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
            {alert.status === "reported"
              ? `Someone confirmed this is real. Switch it off, snap the proof, take ${FIX_POINTS}.`
              : file
                ? `Proof attached — fixing it pays ${FIX_POINTS}, reporting it pays ${REPORT_PROVEN_POINTS}.`
                : `A photo is what pays: ${FIX_POINTS} if you fixed it, ${REPORT_PROVEN_POINTS} if you only report it. A bare report is ${REPORT_BARE_POINTS}.`}
          </p>
        </>
      )}

      {error && <p className="mt-2 text-xs text-flag">{error}</p>}
    </Card>
  );
}

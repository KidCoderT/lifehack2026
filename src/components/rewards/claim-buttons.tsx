"use client";

import { useState, useTransition } from "react";
import { claimGroupVoucher, redeemVoucher } from "@/app/(authed)/vouchers/actions";
import { Button } from "@/components/ui/button";

/** The 8-character code, straight from the database default. Never minted in TypeScript. */
export function VoucherCode({ code }: { code: string }) {
  return (
    <div className="rounded-xl bg-panel px-4 py-3 text-center">
      <p className="text-[11.5px] font-medium tracking-[0.11em] text-panel-foreground uppercase">
        Your code
      </p>
      <p className="pt-1 text-[22px] font-bold tracking-[0.24em] text-panel-foreground">{code}</p>
    </div>
  );
}

/** Community reward: free at the threshold, so no confirm step to sit through. */
export function ClaimQuestButton({ voucherId, title }: { voucherId: number; title: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (code) return <VoucherCode code={code} />;

  return (
    <>
      <Button
        className="w-full"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const res = await claimGroupVoucher(voucherId);
            if (res.ok && res.code) setCode(res.code);
            else setError(res.error ?? "That claim didn't land. Try again.");
          });
        }}
      >
        {pending ? "Claiming…" : `Claim ${title}`}
      </Button>
      {error && <p className="mt-2 text-xs text-flag">{error}</p>}
    </>
  );
}

/** Personal reward: points leave the wallet, so it asks once before spending. */
export function RedeemButton({
  voucherId,
  cost,
  wallet,
}: {
  voucherId: number;
  cost: number;
  wallet: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (code) return <VoucherCode code={code} />;

  if (wallet < cost) {
    return (
      <p className="text-[13px] text-muted">
        {(cost - wallet).toLocaleString()} points short — keep saving.
      </p>
    );
  }

  if (!confirming) {
    return (
      <Button variant="secondary" className="w-full" onClick={() => setConfirming(true)}>
        Redeem
      </Button>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={pending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const res = await redeemVoucher(voucherId);
              // Stay on the confirm step when it fails, so the error has somewhere to render.
              if (res.ok && res.code) setCode(res.code);
              else setError(res.error ?? "That code didn't mint. Try again.");
            });
          }}
        >
          {pending ? "Redeeming…" : `Spend ${cost.toLocaleString()}`}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
          Cancel
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-flag">{error}</p>}
    </>
  );
}

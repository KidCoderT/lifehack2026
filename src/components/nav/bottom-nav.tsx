"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, User, Users, Package, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TABS: { href: string; label: string; icon: LucideIcon; disabled?: boolean }[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/crew", label: "Crew", icon: Users, disabled: true },
  { href: "/vault", label: "Vault", icon: Package, disabled: true },
  { href: "/leaderboard", label: "Ranks", icon: Trophy, disabled: true },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 flex justify-around border-t border-border bg-surface px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {TABS.map(({ href, label, icon: Icon, disabled }) => {
        const active = pathname === href;

        if (disabled) {
          return (
            <div
              key={href}
              aria-disabled="true"
              className="flex flex-col items-center gap-1 px-3 py-1 text-muted opacity-40"
            >
              <Icon className="size-5" />
              <span className="text-[11px]">{label}</span>
            </div>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-1 px-3 py-1 ${
              active ? "text-primary" : "text-muted"
            }`}
          >
            <Icon className="size-5" />
            <span className="text-[11px] font-medium">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Sprout, Zap, Gift, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TABS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/garden", label: "Garden", icon: Sprout },
  { href: "/energy", label: "Energy", icon: Zap },
  { href: "/vouchers", label: "Rewards", icon: Gift },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 flex justify-around border-t border-border bg-surface px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
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

import type { ReactNode } from "react";
import { BottomNav } from "@/components/nav/bottom-nav";

export default function AuthedLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="flex flex-1 flex-col">{children}</div>
      <BottomNav />
    </>
  );
}

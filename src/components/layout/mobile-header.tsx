"use client";

import { RedPandaMascot } from "@/components/ui/red-panda-mascot";

export function MobileHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-14 md:hidden">
      <div className="h-full relative navbar-transparent">
        <div className="absolute top-1/2 left-[44%] -translate-x-1/2 -translate-y-1/2">
          <RedPandaMascot size="sm" />
        </div>
      </div>
    </header>
  );
}

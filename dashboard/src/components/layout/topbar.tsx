"use client";

import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./mobile-nav";

export function Topbar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 lg:px-6">
      <MobileNav />
      <div className="flex-1" />
      <ThemeToggle />
    </header>
  );
}

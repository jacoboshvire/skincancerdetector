"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useFixedOnScroll } from "@/lib/useFixedOnScroll";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/scan", label: "Scan" },
  { href: "/profile", label: "Profile" },
];

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className={className}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export default function AppHeader({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const { ref, scrolled, height } = useFixedOnScroll();

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <>
      {scrolled && <div style={{ height }} aria-hidden />}
      <header
        ref={ref}
        className={`z-30 glass-header transition-all duration-300 ${
          scrolled
            ? "fixed top-[2%] left-1/2 -translate-x-1/2 w-[94%] max-w-5xl rounded-xl border border-foreground/15 shadow-xl"
            : "relative w-full border-b border-foreground/15"
        }`}
      >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <span className="font-bold text-lg flex items-center gap-1 shrink-0 tracking-tight">
            SkinScan<span className="text-muted">^</span>
          </span>
          <nav className="hidden sm:flex gap-1 nav-mono relative">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-2 transition-colors ${
                    active ? "text-primary-foreground" : "hover:bg-foreground/5"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 bg-primary -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden sm:flex items-center gap-4 nav-mono">
          <span className="text-muted truncate max-w-[200px] normal-case">{email}</span>
          <button
            onClick={onLogout}
            className="px-3 py-2 border border-foreground/20 hover:bg-foreground/5 shrink-0"
          >
            Log out
          </button>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className="sm:hidden p-2 -m-2 hover:bg-foreground/5"
        >
          {menuOpen ? <CloseIcon className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="sm:hidden border-t border-foreground/15 overflow-hidden"
          >
            <nav className="flex flex-col px-4 py-3 gap-1 nav-mono">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`px-3 py-2 ${active ? "btn-solid" : "hover:bg-foreground/5"}`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-foreground/15 px-4 py-3 flex items-center justify-between gap-3 nav-mono">
              <span className="text-muted truncate normal-case">{email}</span>
              <button
                onClick={onLogout}
                className="px-3 py-2 border border-foreground/20 hover:bg-foreground/5 shrink-0"
              >
                Log out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </header>
    </>
  );
}

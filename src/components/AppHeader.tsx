"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useFixedOnScroll } from "@/lib/useFixedOnScroll";

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
            ? "fixed top-[2%] left-1/2 -translate-x-1/2 w-[94%] max-w-5xl rounded-2xl border border-foreground/10 shadow-xl"
            : "relative w-full border-b border-foreground/10"
        }`}
      >
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-6 min-w-0">
          <span className="font-bold text-lg flex items-center gap-1.5 shrink-0">
            <motion.span
              className="text-primary text-glow"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              ●
            </motion.span>{" "}
            <span className="gradient-text">SkinScan</span>
          </span>
          <nav className="hidden sm:flex gap-1 text-sm relative">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-1.5 rounded-md transition-colors ${
                    active ? "text-primary-foreground font-medium" : "hover:bg-foreground/5"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 rounded-md btn-gradient shadow-glow -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden sm:flex items-center gap-4 text-sm">
          <span className="text-foreground/60 truncate max-w-[200px]">{email}</span>
          <motion.button
            onClick={onLogout}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="px-3 py-1.5 rounded border border-foreground/15 hover:bg-foreground/5 shrink-0"
          >
            Log out
          </motion.button>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          className="sm:hidden p-2 -m-2 rounded-md hover:bg-foreground/5"
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
            className="sm:hidden border-t border-foreground/10 overflow-hidden"
          >
            <nav className="flex flex-col px-4 py-3 gap-1 text-sm">
              {NAV_LINKS.map((link) => {
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`px-3 py-2 rounded-md ${
                      active ? "btn-gradient font-medium" : "hover:bg-foreground/5"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-foreground/10 px-4 py-3 flex items-center justify-between gap-3 text-sm">
              <span className="text-foreground/60 truncate">{email}</span>
              <button
                onClick={onLogout}
                className="px-3 py-1.5 rounded border border-foreground/15 hover:bg-foreground/5 shrink-0"
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

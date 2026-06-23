"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";

const NAV_LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/scan", label: "Scan" },
  { href: "/profile", label: "Profile" },
];

export default function AppHeader({ email }: { email: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b border-foreground/10 glass-header">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-lg flex items-center gap-1.5">
            <motion.span
              className="text-primary"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              ●
            </motion.span>{" "}
            <span className="gradient-text">SkinScan</span>
          </span>
          <nav className="flex gap-1 text-sm relative">
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
                      className="absolute inset-0 rounded-md bg-primary -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-foreground/60">{email}</span>
          <motion.button
            onClick={onLogout}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            className="px-3 py-1.5 rounded border border-foreground/15 hover:bg-foreground/5"
          >
            Log out
          </motion.button>
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
    <header className="border-b border-black/10 dark:border-white/10 bg-gradient-to-r from-primary-soft/40 to-transparent">
      <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-lg flex items-center gap-1.5">
            <span className="text-primary">●</span> SkinScan
          </span>
          <nav className="flex gap-1 text-sm">
            {NAV_LINKS.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground font-medium"
                      : "hover:bg-black/5 dark:hover:bg-white/10"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-black/60 dark:text-white/60">{email}</span>
          <button
            onClick={onLogout}
            className="px-3 py-1.5 rounded border border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10"
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}

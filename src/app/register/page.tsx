"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import ThemeToggle from "@/components/ThemeToggle";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push("/login?registered=1");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex flex-1 items-center justify-center px-6 py-16 overflow-hidden grid-lines">
      <ThemeToggle className="absolute top-4 right-4" />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative w-full max-w-sm glass-card p-8"
      >
        <span className="font-bold flex items-center gap-1 mb-4 tracking-tight">
          SkinScan<span className="text-muted">^</span>
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight mb-1">Create your account</h1>
        <p className="text-sm text-muted mb-6">
          You&apos;ll verify your email with a one-time code after logging in.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-foreground/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-foreground/20 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-foreground/50"
            />
            <p className="text-xs text-muted mt-1">At least 8 characters.</p>
          </div>
          {error && <p className="text-sm text-accent-red">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-solid py-3 text-sm disabled:opacity-60"
          >
            {loading ? "Creating account…" : "Sign up"}
          </button>
        </form>
        <p className="text-sm text-center mt-6 text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Log in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

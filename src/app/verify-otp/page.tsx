"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function VerifyOtpPage() {
  return (
    <Suspense>
      <VerifyOtpForm />
    </Suspense>
  );
}

function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  async function onResend() {
    setError(null);
    setInfo(null);
    setResending(true);
    try {
      await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setInfo("A new code has been sent.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1">Enter verification code</h1>
        <p className="text-sm text-black/60 dark:text-white/60 mb-6">
          We sent a 6-digit code to <span className="font-medium">{email}</span>.
          In development without SMTP configured, check your server logs for
          the code.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="code">
              Verification code
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm tracking-widest text-center text-lg"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {info && <p className="text-sm text-green-600">{info}</p>}
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full rounded-md bg-foreground text-background py-2.5 font-medium disabled:opacity-60"
          >
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>
        <button
          onClick={onResend}
          disabled={resending}
          className="w-full text-sm text-center mt-6 text-foreground underline disabled:opacity-60"
        >
          {resending ? "Sending…" : "Resend code"}
        </button>
      </div>
    </div>
  );
}

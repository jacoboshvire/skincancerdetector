"use client";

import Link from "next/link";
import { motion } from "framer-motion";

function LightningIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 1 1 8 0v4" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 6h10M9 12h10M9 18h10" />
      <path d="M4.5 6l1 1 1.5-2M4.5 12l1 1 1.5-2M4.5 18l1 1 1.5-2" />
    </svg>
  );
}

function ScanIllustration() {
  return (
    <svg viewBox="0 0 360 360" className="w-full max-w-xs sm:max-w-sm mx-auto" aria-hidden="true">
      <defs>
        <linearGradient id="scanGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="50%" stopColor="var(--accent-purple)" />
          <stop offset="100%" stopColor="var(--accent-pink)" />
        </linearGradient>
      </defs>
      <circle cx="180" cy="180" r="160" fill="url(#scanGradient)" opacity="0.1" />
      <rect
        x="85"
        y="35"
        width="190"
        height="290"
        rx="30"
        fill="var(--background)"
        stroke="url(#scanGradient)"
        strokeWidth="3"
      />
      <rect x="150" y="52" width="60" height="6" rx="3" fill="var(--foreground)" opacity="0.15" />
      <circle cx="180" cy="175" r="50" fill="var(--foreground)" opacity="0.07" />
      <circle
        cx="180"
        cy="175"
        r="50"
        stroke="url(#scanGradient)"
        strokeWidth="3"
        fill="none"
        strokeDasharray="8 10"
        strokeLinecap="round"
      >
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 180 175"
          to="360 180 175"
          dur="7s"
          repeatCount="indefinite"
        />
      </circle>
      <circle cx="180" cy="175" r="18" fill="url(#scanGradient)" />
      <circle cx="232" cy="262" r="24" fill="var(--accent-green)" />
      <path d="M222 262l7 7 13-15" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="125" y="297" width="110" height="9" rx="4.5" fill="var(--foreground)" opacity="0.12" />
    </svg>
  );
}

const FEATURES = [
  {
    title: "Instant results",
    body: "Get a clear risk read on a skin lesion in seconds, no appointment or waiting room needed.",
    icon: LightningIcon,
    color: "border-foreground/15 bg-foreground/5",
  },
  {
    title: "100% private",
    body: "Your photos are analyzed securely and never shared. Nothing leaves your control unless you choose to save a result.",
    icon: ShieldIcon,
    color: "border-foreground/15 bg-foreground/5",
  },
  {
    title: "Secure by design",
    body: "Your account and saved history are protected with strong encryption and two-step verification.",
    icon: LockIcon,
    color: "border-foreground/15 bg-foreground/5",
  },
];

const STEPS = [
  {
    title: "Upload a photo",
    body: "Snap or upload a clear photo of the lesion you're concerned about.",
    icon: CameraIcon,
  },
  {
    title: "Get instant analysis",
    body: "Your photo is screened against seven common lesion categories in seconds.",
    icon: LightningIcon,
  },
  {
    title: "Know your next step",
    body: "See a clear risk breakdown and save it to your medical record to track over time.",
    icon: ChecklistIcon,
  },
];

const TRUST_PILLS = ["Instant results", "100% private", "Free to use"];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-screen overflow-x-hidden">
      <header className="sticky top-0 z-20 border-b border-foreground/10 glass-header">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-semibold text-lg flex items-center gap-1.5">
            <span className="text-primary">●</span> <span className="gradient-text">SkinScan</span>
          </span>
          <nav className="flex gap-4 text-sm">
            <Link href="/login" className="px-3 py-1.5 rounded hover:bg-foreground/5 transition-colors">
              Log in
            </Link>
            <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
              <Link
                href="/register"
                className="px-3 py-1.5 rounded bg-primary text-primary-foreground hover:opacity-90 block"
              >
                Sign up
              </Link>
            </motion.div>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative max-w-5xl mx-auto px-6 py-20 sm:py-24 overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-32 -left-24 w-96 h-96 rounded-full bg-primary/20 blur-3xl animate-blob"
          />
          <div
            aria-hidden
            className="absolute -top-16 right-0 w-96 h-96 rounded-full bg-accent-purple/20 blur-3xl animate-blob-slow"
          />
          <div
            aria-hidden
            className="absolute bottom-0 left-1/3 w-72 h-72 rounded-full bg-accent-pink/15 blur-3xl animate-blob"
          />

          <div className="relative grid sm:grid-cols-2 gap-12 items-center">
            <div className="text-center sm:text-left">
              <motion.h1
                initial="hidden"
                animate="show"
                variants={fadeUp}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="text-4xl sm:text-6xl font-bold tracking-tight"
              >
                Early skin lesion screening,{" "}
                <span className="gradient-text">made effortless</span>
              </motion.h1>
              <motion.p
                initial="hidden"
                animate="show"
                variants={fadeUp}
                transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
                className="mt-6 text-lg text-foreground/70 max-w-xl mx-auto sm:mx-0"
              >
                Upload a photo of a skin lesion and get an instant risk
                assessment across seven common lesion categories, including
                melanoma, basal cell carcinoma, and actinic keratoses.
              </motion.p>
              <motion.div
                initial="hidden"
                animate="show"
                variants={fadeUp}
                transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                className="mt-8 flex gap-3 justify-center sm:justify-start"
              >
                <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/register"
                    className="block px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/25 hover:opacity-90"
                  >
                    Get started
                  </Link>
                </motion.div>
                <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
                  <Link
                    href="/login"
                    className="block px-5 py-2.5 rounded-md border border-foreground/15 font-medium hover:bg-foreground/5"
                  >
                    I already have an account
                  </Link>
                </motion.div>
              </motion.div>
              <motion.div
                initial="hidden"
                animate="show"
                variants={fadeUp}
                transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                className="mt-6 flex flex-wrap gap-2 justify-center sm:justify-start"
              >
                {TRUST_PILLS.map((label) => (
                  <span
                    key={label}
                    className="text-xs font-medium px-3 py-1 rounded-full border border-foreground/15 bg-foreground/5 text-foreground/70"
                  >
                    {label}
                  </span>
                ))}
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.15, ease: "easeOut" }}
              className="relative"
            >
              <ScanIllustration />
            </motion.div>
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 py-12 grid sm:grid-cols-3 gap-6">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
              whileHover={{ y: -6 }}
              className={`rounded-2xl border p-6 shadow-sm hover:shadow-xl transition-shadow ${f.color}`}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5" />
              </div>
              <h2 className="font-semibold mb-2">{f.title}</h2>
              <p className="text-sm text-foreground/70">{f.body}</p>
            </motion.div>
          ))}
        </section>

        <section className="max-w-5xl mx-auto px-6 py-12">
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="text-2xl sm:text-3xl font-bold text-center"
          >
            How it works
          </motion.h2>
          <div className="mt-10 grid sm:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
                className="text-center"
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <s.icon className="w-6 h-6" />
                </div>
                <h3 className="font-semibold mb-1">
                  {i + 1}. {s.title}
                </h3>
                <p className="text-sm text-foreground/70">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-6 py-12">
          <div className="rounded-2xl border border-foreground/15 bg-foreground/5 p-6 text-sm leading-relaxed">
            <strong className="block mb-1">Not a medical device.</strong>
            SkinScan is an educational demonstration of applying machine
            learning to dermoscopic images. It is not FDA-cleared, has not
            been clinically validated, and must never be used as a substitute
            for evaluation by a licensed dermatologist or physician. If you
            are concerned about a skin lesion, seek professional medical care.
          </div>
        </section>
      </main>

      <footer className="border-t border-foreground/10 py-6 text-center text-sm text-foreground/60">
        © Copyright by Ejiro Jacob Oshevire and built by Ejiro Jacob Oshevire
      </footer>
    </div>
  );
}

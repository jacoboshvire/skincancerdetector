"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const FEATURES = [
  {
    title: "On-device inference",
    body: "Images are classified directly in your browser with TensorFlow.js — photos never leave your device unless you choose to save a result to your history.",
    color: "border-accent-blue/30 bg-accent-blue/5",
    titleColor: "text-accent-blue",
  },
  {
    title: "Trained on HAM10000",
    body: "The model is fine-tuned from MobileNetV2 on the HAM10000 dataset, 10,015 dermoscopic images across 7 lesion categories, the standard public benchmark for this task.",
    color: "border-primary/30 bg-primary-soft/20",
    titleColor: "text-primary",
  },
  {
    title: "Secured with JWT + MFA",
    body: "Accounts are protected by password + email one-time-code verification, with short-lived JWT sessions stored in httpOnly cookies.",
    color: "border-accent-purple/30 bg-accent-purple/5",
    titleColor: "text-accent-purple",
  },
];

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
        <section className="relative max-w-5xl mx-auto px-6 py-24 text-center overflow-hidden">
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

          <motion.h1
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative text-4xl sm:text-6xl font-bold tracking-tight"
          >
            Early-stage skin lesion screening,{" "}
            <span className="gradient-text">powered by your browser</span>
          </motion.h1>
          <motion.p
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
            className="relative mt-6 text-lg text-foreground/70 max-w-2xl mx-auto"
          >
            Upload a photo of a skin lesion and get an instant, on-device risk
            assessment across the seven HAM10000 lesion categories — including
            melanoma, basal cell carcinoma, and actinic keratoses.
          </motion.p>
          <motion.div
            initial="hidden"
            animate="show"
            variants={fadeUp}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="relative mt-8 flex gap-3 justify-center"
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
              <h2 className={`font-semibold mb-2 ${f.titleColor}`}>{f.title}</h2>
              <p className="text-sm text-foreground/70">{f.body}</p>
            </motion.div>
          ))}
        </section>

        <section className="max-w-5xl mx-auto px-6 py-12">
          <div className="rounded-2xl border border-accent-amber/40 bg-accent-amber/10 p-6 text-sm leading-relaxed">
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
        Built with Next.js &amp; TensorFlow.js · Model trained on the HAM10000
        dataset
      </footer>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import AppHeader from "@/components/AppHeader";
import HeartButton from "@/components/HeartButton";
import { HAM10000_CLASSES } from "@/lib/modelClasses";
import { assessSymptoms } from "@/lib/symptomRisk";
import { isModelAvailable } from "@/lib/clientModel";

interface ScanRecord {
  id: number;
  imageName: string | null;
  predictedClass: string;
  predictedLabel: string;
  malignantRisk: number;
  confidence: number;
  probabilities: number[];
  bodyLocation: string | null;
  notes: string | null;
  favorite: boolean;
  createdAt: number;
}

interface Profile {
  fullName: string | null;
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

export default function OverviewClient({ email }: { email: string }) {
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [modelReady, setModelReady] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/scans")
      .then((res) => res.json())
      .then((data) => setHistory(data.scans ?? []))
      .finally(() => setLoading(false));

    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => setProfile(data.profile));

    isModelAvailable().then(setModelReady);
  }, []);

  function isFlagged(scan: ScanRecord): boolean {
    const imageMalignant = HAM10000_CLASSES.find((c) => c.code === scan.predictedClass)?.malignant;
    return !!imageMalignant || assessSymptoms(scan.notes).flagged;
  }

  async function onToggleFavorite(scan: ScanRecord) {
    setHistory((prev) =>
      prev.map((s) => (s.id === scan.id ? { ...s, favorite: !s.favorite } : s))
    );
    await fetch(`/api/scans/${scan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !scan.favorite }),
    });
  }

  const flagged = history.filter(isFlagged);
  const favorites = history.filter((s) => s.favorite);
  const recent = history.slice(0, 5);
  const profileComplete = !!profile?.fullName;

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader email={email} />

      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 w-full">
        <motion.div
          initial="hidden"
          animate="show"
          variants={fadeUp}
          transition={{ duration: 0.4 }}
          className="mb-8 flex items-center justify-between flex-wrap gap-4"
        >
          <div>
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-foreground/60 text-sm">{email}</p>
          </div>
          <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
            <Link
              href="/dashboard/scan"
              className="block rounded-md bg-primary text-primary-foreground px-5 py-2.5 font-medium shadow-lg shadow-primary/25 hover:opacity-90"
            >
              + New scan
            </Link>
          </motion.div>
        </motion.div>

        {!loading && flagged.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8 rounded-xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm"
          >
            <strong className="block mb-1">
              {flagged.length} scan{flagged.length === 1 ? "" : "s"} flagged for follow-up.
            </strong>
            Based on image classification and/or reported symptoms. Review them on your{" "}
            <Link href="/profile" className="underline">
              profile page
            </Link>
            , and consider seeing a dermatologist.
          </motion.div>
        )}

        <motion.div
          initial="hidden"
          animate="show"
          transition={{ staggerChildren: 0.08, delayChildren: 0.1 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10"
        >
          <StatCard color="gray" label="Total scans" value={loading ? "…" : history.length} />
          <StatCard color="red" label="Flagged for follow-up" value={loading ? "…" : flagged.length} />
          <StatCard color="gray" label="Favorites" value={loading ? "…" : favorites.length} />
          <StatCard
            color="purple"
            label="Medical record"
            value={profileComplete ? "Complete" : "Incomplete"}
            href="/profile"
          />
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          <section>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-semibold">Recent activity</h2>
              <Link href="/profile" className="text-sm text-primary underline">
                View all
              </Link>
            </div>
            {loading ? (
              <p className="text-sm text-foreground/50">Loading…</p>
            ) : recent.length === 0 ? (
              <p className="text-sm text-foreground/50">
                No scans yet.{" "}
                <Link href="/dashboard/scan" className="underline text-primary">
                  Analyze your first photo
                </Link>
                .
              </p>
            ) : (
              <motion.ul
                initial="hidden"
                animate="show"
                transition={{ staggerChildren: 0.06 }}
                className="space-y-2"
              >
                {recent.map((scan, i) => (
                  <motion.li
                    key={scan.id}
                    variants={fadeUp}
                    transition={{ duration: 0.3 }}
                    whileHover={{ x: 2 }}
                    className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-sm transition-shadow hover:shadow-md ${
                      isFlagged(scan)
                        ? "border-accent-red/30 bg-accent-red/5"
                        : i % 2 === 1
                        ? "border-foreground/10 bg-foreground/5"
                        : "border-foreground/10"
                    }`}
                  >
                    <div>
                      <p className="font-medium">{scan.predictedLabel}</p>
                      <p className="text-foreground/50">
                        {new Date(scan.createdAt).toLocaleDateString()}
                        {scan.bodyLocation && <> · {scan.bodyLocation}</>}
                      </p>
                    </div>
                    <HeartButton active={scan.favorite} onToggle={() => onToggleFavorite(scan)} />
                  </motion.li>
                ))}
              </motion.ul>
            )}
          </section>

          <section>
            <h2 className="font-semibold mb-3">Quick links</h2>
            <div className="space-y-3">
              <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
                <Link
                  href="/dashboard/scan"
                  className="block rounded-xl border border-primary/30 bg-primary-soft/20 p-4 hover:shadow-lg hover:shadow-primary/15 transition-shadow"
                >
                  <p className="font-medium text-primary">Analyze a new photo</p>
                  <p className="text-sm text-foreground/60">
                    Upload a lesion image for on-device classification.
                  </p>
                </Link>
              </motion.div>
              <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
                <Link
                  href="/profile"
                  className="block rounded-xl border border-foreground/15 bg-foreground/5 p-4 hover:shadow-lg hover:shadow-foreground/10 transition-shadow"
                >
                  <p className="font-medium text-foreground">
                    {profileComplete ? "Edit your medical record" : "Complete your medical record"}
                  </p>
                  <p className="text-sm text-foreground/60">
                    Background details (name, DOB, family history) for context on your history.
                  </p>
                </Link>
              </motion.div>
              <motion.div
                whileHover={{ y: -3 }}
                transition={{ duration: 0.2 }}
                className={`rounded-xl border p-4 ${
                  modelReady
                    ? "border-accent-green/30 bg-accent-green/5"
                    : "border-accent-amber/30 bg-accent-amber/5"
                }`}
              >
                <p
                  className={`font-medium ${
                    modelReady
                      ? "text-accent-green"
                      : "text-accent-amber"
                  }`}
                >
                  {modelReady === null ? "Checking model…" : modelReady ? "Model ready" : "Model not trained yet"}
                </p>
                <p className="text-sm text-foreground/60">
                  {modelReady
                    ? "TensorFlow.js classifier is loaded and ready to analyze images."
                    : "Run the training pipeline in scripts/train_model — see the README."}
                </p>
              </motion.div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

const STAT_COLORS = {
  blue: "border-accent-blue/30 bg-accent-blue/10 text-accent-blue hover:shadow-accent-blue/20",
  red: "border-accent-red/30 bg-accent-red/10 text-accent-red hover:shadow-accent-red/20",
  pink: "border-accent-pink/30 bg-accent-pink/10 text-accent-pink hover:shadow-accent-pink/20",
  purple: "border-accent-purple/30 bg-accent-purple/10 text-accent-purple hover:shadow-accent-purple/20",
  gray: "border-foreground/15 bg-foreground/5 text-foreground hover:shadow-foreground/10",
};

function StatCard({
  color,
  label,
  value,
  href,
}: {
  color: keyof typeof STAT_COLORS;
  label: string;
  value: string | number;
  href?: string;
}) {
  const content = (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.3 }}
      className={`rounded-xl border p-4 hover:shadow-lg transition-shadow ${STAT_COLORS[color]}`}
    >
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm mt-1 text-foreground/60">{label}</p>
    </motion.div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

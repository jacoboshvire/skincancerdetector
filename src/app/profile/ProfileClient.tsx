"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import AppHeader from "@/components/AppHeader";
import HeartButton from "@/components/HeartButton";
import { HAM10000_CLASSES } from "@/lib/modelClasses";
import { assessSymptoms } from "@/lib/symptomRisk";

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
  dateOfBirth: string | null;
  sex: string | null;
  familyHistorySkinCancer: boolean;
  notes: string | null;
  updatedAt: number;
}

const SEX_OPTIONS = [
  { value: "unspecified", label: "Prefer not to say" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];

export default function ProfileClient({ email }: { email: string }) {
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sex, setSex] = useState("unspecified");
  const [familyHistory, setFamilyHistory] = useState(false);
  const [notes, setNotes] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [filter, setFilter] = useState<"all" | "favorites">("all");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setCreatedAt(data.createdAt ?? null));

    fetch("/api/scans")
      .then((res) => res.json())
      .then((data) => setHistory(data.scans ?? []))
      .finally(() => setHistoryLoading(false));

    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        const p: Profile | null = data.profile;
        if (p) {
          setFullName(p.fullName ?? "");
          setDateOfBirth(p.dateOfBirth ?? "");
          setSex(p.sex ?? "unspecified");
          setFamilyHistory(p.familyHistorySkinCancer);
          setNotes(p.notes ?? "");
        }
      })
      .finally(() => setProfileLoading(false));
  }, []);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setSavedProfile(false);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName || null,
          dateOfBirth: dateOfBirth || null,
          sex,
          familyHistorySkinCancer: familyHistory,
          notes: notes || null,
        }),
      });
      if (res.ok) setSavedProfile(true);
    } finally {
      setSavingProfile(false);
    }
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

  function isFlagged(scan: ScanRecord): boolean {
    const imageMalignant = HAM10000_CLASSES.find((c) => c.code === scan.predictedClass)?.malignant;
    return !!imageMalignant || assessSymptoms(scan.notes).flagged;
  }

  const malignantCount = history.filter(isFlagged).length;
  const visibleHistory = filter === "favorites" ? history.filter((s) => s.favorite) : history;

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader email={email} />

      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 w-full space-y-12">
        <motion.section
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-2xl font-bold mb-1">Profile</h1>
          <p className="text-sm text-foreground/60">
            {email}
            {createdAt && <> · Member since {new Date(createdAt).toLocaleDateString()}</>}
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.05 }}
          className="rounded-2xl border border-foreground/15 bg-foreground/5 p-5 shadow-sm"
        >
          <h2 className="font-semibold mb-3">Medical record</h2>
          <p className="text-sm text-foreground/60 mb-4">
            Optional background information to give context to your scan
            history. Stored with your account only — never sent to the
            classifier.
          </p>
          {profileLoading ? (
            <p className="text-sm text-foreground/50">Loading…</p>
          ) : (
            <form onSubmit={onSaveProfile} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="fullName">
                  Full name
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple/40 focus:border-accent-purple/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="dob">
                    Date of birth
                  </label>
                  <input
                    id="dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple/40 focus:border-accent-purple/50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" htmlFor="sex">
                    Sex
                  </label>
                  <select
                    id="sex"
                    value={sex}
                    onChange={(e) => setSex(e.target.value)}
                    className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple/40 focus:border-accent-purple/50"
                  >
                    {SEX_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={familyHistory}
                  onChange={(e) => setFamilyHistory(e.target.checked)}
                />
                Family history of skin cancer
              </label>
              <div>
                <label className="block text-sm font-medium mb-1" htmlFor="profileNotes">
                  Other notes (allergies, conditions, etc.)
                </label>
                <textarea
                  id="profileNotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple/40 focus:border-accent-purple/50"
                />
              </div>
              <motion.button
                type="submit"
                disabled={savingProfile}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="rounded-md bg-accent-purple text-white px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 shadow-md shadow-accent-purple/20"
              >
                {savingProfile ? "Saving…" : "Save"}
              </motion.button>
              <AnimatePresence>
                {savedProfile && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="ml-3 text-sm text-accent-green"
                  >
                    Saved.
                  </motion.span>
                )}
              </AnimatePresence>
            </form>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
            <h2 className="font-semibold">Medical history</h2>
            <div className="flex items-center gap-3">
              {!historyLoading && history.length > 0 && (
                <p className="text-sm text-foreground/60">
                  {history.length} scan{history.length === 1 ? "" : "s"} ·{" "}
                  {malignantCount} flagged for follow-up
                </p>
              )}
              <div className="relative flex rounded-md border border-foreground/15 overflow-hidden text-sm">
                <button
                  onClick={() => setFilter("all")}
                  className={`relative px-3 py-1 transition-colors ${filter === "all" ? "text-primary-foreground" : "hover:bg-foreground/5"}`}
                >
                  {filter === "all" && (
                    <motion.span
                      layoutId="filter-pill"
                      className="absolute inset-0 bg-primary -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  All
                </button>
                <button
                  onClick={() => setFilter("favorites")}
                  className={`relative px-3 py-1 transition-colors ${filter === "favorites" ? "text-white" : "hover:bg-foreground/5"}`}
                >
                  {filter === "favorites" && (
                    <motion.span
                      layoutId="filter-pill"
                      className="absolute inset-0 bg-accent-pink -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                    />
                  )}
                  Favorites
                </button>
              </div>
            </div>
          </div>

          {historyLoading ? (
            <p className="text-sm text-foreground/50">Loading…</p>
          ) : visibleHistory.length === 0 ? (
            <p className="text-sm text-foreground/50">
              {filter === "favorites" ? (
                "No favorited scans yet."
              ) : (
                <>
                  No scans saved yet. Analyze and save a scan from the{" "}
                  <Link href="/dashboard/scan" className="underline">
                    scan tool
                  </Link>{" "}
                  to build your history.
                </>
              )}
            </p>
          ) : (
            <motion.div layout className="space-y-3">
              <AnimatePresence initial={false}>
                {visibleHistory.map((scan, i) => {
                  const imageMalignant = HAM10000_CLASSES.find((c) => c.code === scan.predictedClass)?.malignant;
                  const symptomFlagged = assessSymptoms(scan.notes).flagged;
                  const flagged = imageMalignant || symptomFlagged;
                  return (
                    <motion.div
                      key={scan.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.25 }}
                      whileHover={{ x: 2 }}
                      className={`rounded-xl border p-4 transition-shadow hover:shadow-md ${
                        flagged
                          ? "border-accent-red/40 bg-accent-red/5"
                          : i % 2 === 1
                          ? "border-foreground/10 bg-foreground/5"
                          : "border-foreground/10"
                      }`}
                    >
                      <div className="flex items-start justify-between flex-wrap gap-2">
                        <div className="flex items-start gap-2">
                          <HeartButton active={scan.favorite} onToggle={() => onToggleFavorite(scan)} />
                          <div>
                            <p className="font-medium">
                              {scan.predictedLabel}{" "}
                              {imageMalignant && (
                                <span className="text-accent-red text-xs font-medium">(malignant)</span>
                              )}
                              {!imageMalignant && symptomFlagged && (
                                <span className="text-accent-red text-xs font-medium">(symptoms flagged)</span>
                              )}
                            </p>
                            <p className="text-sm text-foreground/60">
                              {new Date(scan.createdAt).toLocaleString()}
                              {scan.bodyLocation && <> · {scan.bodyLocation}</>}
                              {scan.imageName && <> · {scan.imageName}</>}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm text-right">
                          Confidence {(scan.confidence * 100).toFixed(1)}%
                          <br />
                          Malignant risk {(scan.malignantRisk * 100).toFixed(1)}%
                        </p>
                      </div>
                      {scan.notes && (
                        <p className="mt-2 text-sm text-foreground/70">
                          <span className="font-medium">Symptom notes:</span> {scan.notes}
                        </p>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </motion.div>
          )}
        </motion.section>
      </main>
    </div>
  );
}

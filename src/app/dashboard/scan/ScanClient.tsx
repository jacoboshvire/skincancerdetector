"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type * as tf from "@tensorflow/tfjs";
import { motion, AnimatePresence } from "framer-motion";
import AppHeader from "@/components/AppHeader";
import HeartButton from "@/components/HeartButton";
import { loadModel, predictFromImage, isModelAvailable } from "@/lib/clientModel";
import { HAM10000_CLASSES, malignantRiskFromProbabilities, topPrediction } from "@/lib/modelClasses";
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

type ModelStatus = "checking" | "missing" | "loading" | "ready" | "error";

const BODY_LOCATIONS = [
  "Head / neck",
  "Chest",
  "Back",
  "Abdomen",
  "Arm",
  "Hand",
  "Leg",
  "Foot",
  "Other",
];

export default function ScanClient({ email }: { email: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const [modelStatus, setModelStatus] = useState<ModelStatus>("checking");
  const [modelError, setModelError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [probabilities, setProbabilities] = useState<number[] | null>(null);
  const [bodyLocation, setBodyLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    isModelAvailable().then((available) => setModelStatus(available ? "loading" : "missing"));
  }, []);

  useEffect(() => {
    if (modelStatus !== "loading") return;
    loadModel()
      .then(() => setModelStatus("ready"))
      .catch((err) => {
        setModelError(err instanceof Error ? err.message : String(err));
        setModelStatus("error");
      });
  }, [modelStatus]);

  useEffect(() => {
    fetch("/api/scans")
      .then((res) => res.json())
      .then((data) => setHistory(data.scans ?? []))
      .finally(() => setHistoryLoading(false));
  }, []);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProbabilities(null);
    setImageName(file.name);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }

  function onReset() {
    setImagePreview(null);
    setImageName(null);
    setProbabilities(null);
    setBodyLocation("");
    setNotes("");
    setSaved(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const onAnalyze = useCallback(async () => {
    if (!imageRef.current || modelStatus !== "ready") return;
    setAnalyzing(true);
    try {
      const model = (await loadModel()) as tf.LayersModel;
      const probs = await predictFromImage(model, imageRef.current);
      setProbabilities(probs);
    } catch (err) {
      setModelError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }, [modelStatus]);

  async function onSaveResult() {
    if (!probabilities) return;
    setSaving(true);
    setSaved(false);
    try {
      const { cls, confidence } = topPrediction(probabilities);
      const malignantRisk = malignantRiskFromProbabilities(probabilities);
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageName,
          predictedClass: cls.code,
          predictedLabel: cls.label,
          malignantRisk,
          confidence,
          probabilities,
          bodyLocation: bodyLocation || null,
          notes: notes || null,
        }),
      });
      if (res.ok) {
        const refreshed = await fetch("/api/scans").then((r) => r.json());
        setHistory(refreshed.scans ?? []);
        setSaved(true);
        setBodyLocation("");
        setNotes("");
      }
    } finally {
      setSaving(false);
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

  const top = probabilities ? topPrediction(probabilities) : null;
  const malignantRisk = probabilities ? malignantRiskFromProbabilities(probabilities) : null;
  const symptomAssessment = assessSymptoms(notes);
  const isConcern = probabilities ? top!.cls.malignant || symptomAssessment.flagged : false;

  return (
    <div className="flex flex-col min-h-screen">
      <AppHeader email={email} />

      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 w-full">
        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-2xl font-bold mb-6"
        >
          Scan a lesion
        </motion.h1>

        {modelStatus === "missing" && (
          <div className="mb-8 rounded-xl border border-accent-amber/40 bg-accent-amber/10 p-4 text-sm">
            <strong className="block mb-1">No trained model found.</strong>
            Run the training pipeline in <code>scripts/train_model</code> to
            generate <code>public/model/model.json</code> before analyzing
            images. See the README for instructions.
          </div>
        )}
        {modelStatus === "error" && (
          <div className="mb-8 rounded-xl border border-accent-red/40 bg-accent-red/10 p-4 text-sm">
            <strong className="block mb-1">Failed to load model.</strong>
            {modelError}
          </div>
        )}

        <div className="mb-8 rounded-xl border border-accent-amber/40 bg-accent-amber/10 p-4 text-sm">
          This tool is for educational purposes only and is not a substitute
          for professional medical diagnosis.
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="rounded-2xl border border-foreground/10 p-5 shadow-sm"
          >
            <h2 className="font-semibold mb-3 text-primary">Upload a lesion photo</h2>
            <motion.div
              animate={imagePreview ? { borderColor: "var(--primary)" } : {}}
              className="rounded-xl border border-dashed border-primary/30 bg-primary-soft/20 p-6 text-center"
            >
              <AnimatePresence mode="wait">
                {imagePreview ? (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={imageRef}
                      src={imagePreview}
                      alt="Selected lesion"
                      crossOrigin="anonymous"
                      className="max-h-64 mx-auto rounded-md object-contain"
                    />
                  </motion.div>
                ) : (
                  <motion.p
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-sm text-foreground/50 py-12"
                  >
                    No image selected
                  </motion.p>
                )}
              </AnimatePresence>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="mt-4 text-sm"
              />
            </motion.div>

            <div className="mt-4 space-y-2">
              <div>
                <label className="block text-xs font-medium mb-1" htmlFor="bodyLocation">
                  Location on body (optional)
                </label>
                <select
                  id="bodyLocation"
                  value={bodyLocation}
                  onChange={(e) => setBodyLocation(e.target.value)}
                  className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50"
                >
                  <option value="">Not specified</option>
                  {BODY_LOCATIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" htmlFor="notes">
                  Symptom notes (optional)
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. itchy, recently changed size or color"
                  className="w-full rounded-md border border-foreground/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50"
                />
                <p className="text-xs text-foreground/50 mt-1">
                  Factored into the result below alongside the image — things like recent
                  change, bleeding, or itching matter even if a photo looks benign.
                </p>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <motion.button
                onClick={onAnalyze}
                disabled={!imagePreview || modelStatus !== "ready" || analyzing}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 rounded-md bg-primary text-primary-foreground py-2.5 font-medium disabled:opacity-50 hover:opacity-90 shadow-md shadow-primary/20"
              >
                {analyzing ? (
                  <span className="inline-flex items-center gap-2 justify-center">
                    <motion.span
                      className="w-3.5 h-3.5 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                    />
                    Analyzing…
                  </span>
                ) : (
                  "Analyze image"
                )}
              </motion.button>
              <motion.button
                onClick={onReset}
                disabled={!imagePreview}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                title="Clear the current image and result"
                className="rounded-md border border-foreground/15 px-4 py-2.5 text-sm font-medium hover:bg-foreground/5 disabled:opacity-50"
              >
                Reset
              </motion.button>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="rounded-2xl border border-foreground/10 p-5 shadow-sm"
          >
            <h2 className="font-semibold mb-3 text-primary">Result</h2>
            <AnimatePresence mode="wait">
              {!probabilities ? (
                <motion.p
                  key="empty-result"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-foreground/50"
                >
                  Upload and analyze an image to see results here.
                </motion.p>
              ) : (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-4"
                >
                  <motion.div
                    initial={{ scale: 0.97 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className={`rounded-xl p-4 border ${
                      isConcern ? "border-accent-red/40 bg-accent-red/10" : "border-accent-green/40 bg-accent-green/10"
                    }`}
                  >
                    {top!.cls.malignant ? (
                      <p className="text-sm text-foreground/60">Top prediction</p>
                    ) : symptomAssessment.flagged ? (
                      <p className="font-semibold text-accent-red">
                        ⚠ Image looks benign, but reported symptoms warrant a check-up
                      </p>
                    ) : (
                      <p className="font-semibold text-accent-green">
                        ✓ Healthy skin
                      </p>
                    )}
                    <p className="font-semibold">{top!.cls.label}</p>
                    <p className="text-sm mt-1">
                      Confidence: {(top!.confidence * 100).toFixed(1)}% · Overall
                      malignant-category risk: {(malignantRisk! * 100).toFixed(1)}%
                    </p>
                    {symptomAssessment.flagged && (
                      <p className="text-sm mt-2">
                        Symptom notes mention:{" "}
                        <span className="font-medium">{symptomAssessment.matchedKeywords.join(", ")}</span>
                        . A single photo can't show change over time — these are classic reasons to
                        get a lesion checked regardless of how it looks in one image.
                      </p>
                    )}
                  </motion.div>

                  <ul className="space-y-2">
                    {HAM10000_CLASSES.map((cls, i) => (
                      <li key={cls.code} className="text-sm">
                        <div className="flex justify-between mb-1">
                          <span>
                            {cls.label}{" "}
                            {cls.malignant && (
                              <span className="text-accent-red text-xs font-medium">(malignant)</span>
                            )}
                          </span>
                          <span>{((probabilities[i] ?? 0) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="h-1.5 rounded bg-foreground/10 overflow-hidden">
                          <motion.div
                            className={`h-full ${cls.malignant ? "bg-accent-red" : "bg-accent-green"}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${(probabilities[i] ?? 0) * 100}%` }}
                            transition={{ duration: 0.6, delay: i * 0.04, ease: "easeOut" }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>

                  <motion.button
                    onClick={onSaveResult}
                    disabled={saving}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full rounded-md border border-primary/40 text-primary py-2 text-sm font-medium hover:bg-primary-soft/30 disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save to medical record"}
                  </motion.button>
                  <AnimatePresence>
                    {saved && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-sm text-accent-green"
                      >
                        Saved. View your full history on your{" "}
                        <Link href="/profile" className="underline">
                          profile page
                        </Link>
                        .
                      </motion.p>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        </div>

        <section className="mt-12">
          <h2 className="font-semibold mb-3">Scan history</h2>
          {historyLoading ? (
            <p className="text-sm text-foreground/50">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-foreground/50">No saved scans yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-foreground/50 border-b border-foreground/10">
                    <th className="py-2 pr-4"></th>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Location</th>
                    <th className="py-2 pr-4">Image</th>
                    <th className="py-2 pr-4">Prediction</th>
                    <th className="py-2 pr-4">Confidence</th>
                    <th className="py-2 pr-4">Malignant risk</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((scan) => (
                    <tr key={scan.id} className="border-b border-foreground/5 hover:bg-foreground/5 transition-colors">
                      <td className="py-2 pr-4">
                        <HeartButton
                          size="sm"
                          active={scan.favorite}
                          onToggle={() => onToggleFavorite(scan)}
                        />
                      </td>
                      <td className="py-2 pr-4">{new Date(scan.createdAt).toLocaleString()}</td>
                      <td className="py-2 pr-4">{scan.bodyLocation ?? "—"}</td>
                      <td className="py-2 pr-4">{scan.imageName ?? "—"}</td>
                      <td className="py-2 pr-4">{scan.predictedLabel}</td>
                      <td className="py-2 pr-4">{(scan.confidence * 100).toFixed(1)}%</td>
                      <td className="py-2 pr-4">{(scan.malignantRisk * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-sm text-foreground/50">
            See your full medical history, including symptom notes, on your{" "}
            <Link href="/profile" className="underline">
              profile page
            </Link>
            .
          </p>
        </section>
      </main>
    </div>
  );
}

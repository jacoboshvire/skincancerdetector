"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type * as tf from "@tensorflow/tfjs";
import { loadModel, predictFromImage, isModelAvailable } from "@/lib/clientModel";
import { HAM10000_CLASSES, malignantRiskFromProbabilities, topPrediction } from "@/lib/modelClasses";

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

export default function DashboardClient({ email }: { email: string }) {
  const router = useRouter();
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

  async function onLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const top = probabilities ? topPrediction(probabilities) : null;
  const malignantRisk = probabilities ? malignantRiskFromProbabilities(probabilities) : null;

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-black/10 dark:border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-semibold text-lg">SkinScan</span>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/profile" className="px-3 py-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10">
              Profile
            </Link>
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

      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 w-full">
        {modelStatus === "missing" && (
          <div className="mb-8 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
            <strong className="block mb-1">No trained model found.</strong>
            Run the training pipeline in <code>scripts/train_model</code> to
            generate <code>public/model/model.json</code> before analyzing
            images. See the README for instructions.
          </div>
        )}
        {modelStatus === "error" && (
          <div className="mb-8 rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm">
            <strong className="block mb-1">Failed to load model.</strong>
            {modelError}
          </div>
        )}

        <div className="mb-8 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          This tool is for educational purposes only and is not a substitute
          for professional medical diagnosis.
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <section>
            <h2 className="font-semibold mb-3">Upload a lesion photo</h2>
            <div className="rounded-lg border border-dashed border-black/20 dark:border-white/20 p-6 text-center">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  ref={imageRef}
                  src={imagePreview}
                  alt="Selected lesion"
                  crossOrigin="anonymous"
                  className="max-h-64 mx-auto rounded-md object-contain"
                />
              ) : (
                <p className="text-sm text-black/50 dark:text-white/50 py-12">
                  No image selected
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="mt-4 text-sm"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={onAnalyze}
                disabled={!imagePreview || modelStatus !== "ready" || analyzing}
                className="flex-1 rounded-md bg-foreground text-background py-2.5 font-medium disabled:opacity-50"
              >
                {analyzing ? "Analyzing…" : "Analyze image"}
              </button>
              <button
                onClick={onReset}
                disabled={!imagePreview}
                title="Clear the current image and result"
                className="rounded-md border border-black/15 dark:border-white/20 px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          </section>

          <section>
            <h2 className="font-semibold mb-3">Result</h2>
            {!probabilities ? (
              <p className="text-sm text-black/50 dark:text-white/50">
                Upload and analyze an image to see results here.
              </p>
            ) : (
              <div className="space-y-4">
                <div
                  className={`rounded-lg p-4 border ${
                    top!.cls.malignant
                      ? "border-red-500/40 bg-red-500/10"
                      : "border-green-500/40 bg-green-500/10"
                  }`}
                >
                  <p className="text-sm text-black/60 dark:text-white/60">Top prediction</p>
                  <p className="font-semibold">{top!.cls.label}</p>
                  <p className="text-sm mt-1">
                    Confidence: {(top!.confidence * 100).toFixed(1)}% · Overall
                    malignant-category risk: {(malignantRisk! * 100).toFixed(1)}%
                  </p>
                </div>

                <ul className="space-y-2">
                  {HAM10000_CLASSES.map((cls, i) => (
                    <li key={cls.code} className="text-sm">
                      <div className="flex justify-between mb-1">
                        <span>
                          {cls.label}{" "}
                          {cls.malignant && (
                            <span className="text-red-600 text-xs font-medium">(malignant)</span>
                          )}
                        </span>
                        <span>{((probabilities[i] ?? 0) * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 rounded bg-black/10 dark:bg-white/10 overflow-hidden">
                        <div
                          className={`h-full ${cls.malignant ? "bg-red-500" : "bg-green-500"}`}
                          style={{ width: `${(probabilities[i] ?? 0) * 100}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="space-y-2 pt-2 border-t border-black/10 dark:border-white/10">
                  <div>
                    <label className="block text-xs font-medium mb-1" htmlFor="bodyLocation">
                      Location on body (optional)
                    </label>
                    <select
                      id="bodyLocation"
                      value={bodyLocation}
                      onChange={(e) => setBodyLocation(e.target.value)}
                      className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
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
                      className="w-full rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <button
                  onClick={onSaveResult}
                  disabled={saving}
                  className="w-full rounded-md border border-black/15 dark:border-white/20 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save to medical record"}
                </button>
                {saved && (
                  <p className="text-sm text-green-600">
                    Saved. View your full history on your{" "}
                    <Link href="/profile" className="underline">
                      profile page
                    </Link>
                    .
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        <section className="mt-12">
          <h2 className="font-semibold mb-3">Scan history</h2>
          {historyLoading ? (
            <p className="text-sm text-black/50 dark:text-white/50">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">No saved scans yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-black/50 dark:text-white/50 border-b border-black/10 dark:border-white/10">
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
                    <tr key={scan.id} className="border-b border-black/5 dark:border-white/5">
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
          <p className="mt-3 text-sm text-black/50 dark:text-white/50">
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

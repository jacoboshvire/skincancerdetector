import { SymptomAssessment } from "@/lib/symptomRisk";

// Combines the image classifier's malignant-category probability with other
// signals already sitting in the database (profile risk factors, symptom
// notes, trend across prior scans at the same body location) into a single
// score. This is an educational heuristic, not a calibrated clinical risk
// model: the image probability is the anchor and every other signal only
// adds a small, capped, additive nudge on top of it, so the combined score
// never drifts far from what the classifier itself said and each nudge can
// be explained individually (see `factors`).
export interface RiskFactor {
  label: string;
  contribution: number; // 0..1, additive percentage points folded into the combined score
  detail: string;
}

export interface RiskFusionInput {
  imageMalignantRisk: number;
  symptomAssessment: SymptomAssessment;
  dateOfBirth: string | null | undefined;
  familyHistorySkinCancer: boolean | null | undefined;
  /** Prior saved scans at the same body location, most-recent-first or not (order doesn't matter). */
  priorScansAtLocation: { malignantRisk: number; createdAt: number }[];
}

export interface RiskFusionResult {
  combinedRisk: number;
  factors: RiskFactor[];
}

function ageFromDateOfBirth(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const parsed = new Date(dob);
  if (Number.isNaN(parsed.getTime())) return null;
  const age = (Date.now() - parsed.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  return age > 0 && age < 130 ? age : null;
}

export function combineRisk(input: RiskFusionInput): RiskFusionResult {
  const factors: RiskFactor[] = [
    {
      label: "Image classifier",
      contribution: input.imageMalignantRisk,
      detail: "Malignant-category probability from the CNN's prediction on this photo.",
    },
  ];

  if (input.symptomAssessment.flagged) {
    const bump = Math.min(input.symptomAssessment.matchedKeywords.length * 0.04, 0.15);
    factors.push({
      label: "Symptom notes",
      contribution: bump,
      detail: `Reported: ${input.symptomAssessment.matchedKeywords.join(", ")}. A single photo can't show change over time.`,
    });
  }

  if (input.familyHistorySkinCancer) {
    factors.push({
      label: "Family history",
      contribution: 0.08,
      detail: "A family history of skin cancer is a recognized risk factor.",
    });
  }

  const age = ageFromDateOfBirth(input.dateOfBirth);
  if (age !== null && age >= 50) {
    factors.push({
      label: "Age",
      contribution: age >= 65 ? 0.08 : 0.05,
      detail: `Risk of malignant lesions rises with age (age ${Math.floor(age)}).`,
    });
  }

  if (input.priorScansAtLocation.length >= 2) {
    const sorted = [...input.priorScansAtLocation].sort((a, b) => a.createdAt - b.createdAt);
    const earliest = sorted[0].malignantRisk;
    const latest = sorted[sorted.length - 1].malignantRisk;
    const rise = latest - earliest;
    if (rise > 0.1) {
      factors.push({
        label: "Rising trend at this location",
        contribution: 0.07,
        detail: `Malignant-category risk at this body location has risen ${Math.round(rise * 100)} points over your last ${sorted.length} scans there.`,
      });
    }
  }

  const combinedRisk = Math.min(
    1,
    factors.reduce((sum, f) => sum + f.contribution, 0)
  );

  return { combinedRisk, factors };
}

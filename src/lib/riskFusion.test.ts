import { describe, expect, it } from "vitest";
import { combineRisk } from "./riskFusion";
import { SymptomAssessment } from "./symptomRisk";

const noSymptoms: SymptomAssessment = { flagged: false, matchedKeywords: [] };

function baseInput(overrides: Partial<Parameters<typeof combineRisk>[0]> = {}) {
  return {
    imageMalignantRisk: 0.2,
    symptomAssessment: noSymptoms,
    dateOfBirth: null,
    familyHistorySkinCancer: false,
    priorScansAtLocation: [],
    ...overrides,
  };
}

describe("combineRisk", () => {
  it("returns just the image classifier factor when no other signals apply", () => {
    const result = combineRisk(baseInput({ imageMalignantRisk: 0.35 }));
    expect(result.combinedRisk).toBeCloseTo(0.35);
    expect(result.factors).toHaveLength(1);
    expect(result.factors[0].label).toBe("Image classifier");
    expect(result.factors[0].contribution).toBe(0.35);
  });

  it("adds a capped symptom bump proportional to matched keyword count", () => {
    const result = combineRisk(
      baseInput({
        imageMalignantRisk: 0.1,
        symptomAssessment: { flagged: true, matchedKeywords: ["bleed", "itch"] },
      })
    );
    const symptomFactor = result.factors.find((f) => f.label === "Symptom notes");
    expect(symptomFactor?.contribution).toBeCloseTo(0.08); // 2 keywords * 0.04
    expect(result.combinedRisk).toBeCloseTo(0.18);
  });

  it("caps the symptom bump at 0.15 regardless of how many keywords match", () => {
    const result = combineRisk(
      baseInput({
        imageMalignantRisk: 0,
        symptomAssessment: {
          flagged: true,
          matchedKeywords: ["a", "b", "c", "d", "e", "f", "g", "h"], // 8 * 0.04 = 0.32, capped to 0.15
        },
      })
    );
    const symptomFactor = result.factors.find((f) => f.label === "Symptom notes");
    expect(symptomFactor?.contribution).toBe(0.15);
  });

  it("adds a family history factor when true, omits it when false or nullish", () => {
    const withHistory = combineRisk(baseInput({ familyHistorySkinCancer: true }));
    expect(withHistory.factors.find((f) => f.label === "Family history")?.contribution).toBe(0.08);

    const withoutHistory = combineRisk(baseInput({ familyHistorySkinCancer: false }));
    expect(withoutHistory.factors.find((f) => f.label === "Family history")).toBeUndefined();

    const nullHistory = combineRisk(baseInput({ familyHistorySkinCancer: null }));
    expect(nullHistory.factors.find((f) => f.label === "Family history")).toBeUndefined();
  });

  it("adds an age factor of 0.05 for ages 50-64 and 0.08 for 65+", () => {
    const now = Date.now();
    const dobForAge = (age: number) => new Date(now - age * 365.25 * 24 * 60 * 60 * 1000).toISOString();

    const age55 = combineRisk(baseInput({ dateOfBirth: dobForAge(55) }));
    expect(age55.factors.find((f) => f.label === "Age")?.contribution).toBe(0.05);

    const age70 = combineRisk(baseInput({ dateOfBirth: dobForAge(70) }));
    expect(age70.factors.find((f) => f.label === "Age")?.contribution).toBe(0.08);

    const age30 = combineRisk(baseInput({ dateOfBirth: dobForAge(30) }));
    expect(age30.factors.find((f) => f.label === "Age")).toBeUndefined();
  });

  it("ignores an invalid or missing date of birth", () => {
    const invalid = combineRisk(baseInput({ dateOfBirth: "not-a-date" }));
    expect(invalid.factors.find((f) => f.label === "Age")).toBeUndefined();

    const missing = combineRisk(baseInput({ dateOfBirth: undefined }));
    expect(missing.factors.find((f) => f.label === "Age")).toBeUndefined();
  });

  it("flags a rising trend across 2+ prior scans at the same location when the rise exceeds 0.1", () => {
    const result = combineRisk(
      baseInput({
        priorScansAtLocation: [
          { malignantRisk: 0.1, createdAt: 1000 },
          { malignantRisk: 0.3, createdAt: 2000 },
        ],
      })
    );
    const trendFactor = result.factors.find((f) => f.label === "Rising trend at this location");
    expect(trendFactor?.contribution).toBe(0.07);
  });

  it("does not flag a trend when the rise is 0.1 or less", () => {
    const result = combineRisk(
      baseInput({
        priorScansAtLocation: [
          { malignantRisk: 0.1, createdAt: 1000 },
          { malignantRisk: 0.2, createdAt: 2000 },
        ],
      })
    );
    expect(result.factors.find((f) => f.label === "Rising trend at this location")).toBeUndefined();
  });

  it("does not flag a trend with fewer than 2 prior scans", () => {
    const result = combineRisk(
      baseInput({
        priorScansAtLocation: [{ malignantRisk: 0.9, createdAt: 1000 }],
      })
    );
    expect(result.factors.find((f) => f.label === "Rising trend at this location")).toBeUndefined();
  });

  it("sorts prior scans by createdAt before computing the trend, regardless of input order", () => {
    const result = combineRisk(
      baseInput({
        priorScansAtLocation: [
          { malignantRisk: 0.4, createdAt: 3000 }, // latest
          { malignantRisk: 0.1, createdAt: 1000 }, // earliest
          { malignantRisk: 0.2, createdAt: 2000 },
        ],
      })
    );
    const trendFactor = result.factors.find((f) => f.label === "Rising trend at this location");
    expect(trendFactor).toBeDefined();
    expect(trendFactor?.detail).toContain("3 scans");
  });

  it("caps the combined risk at 1 even when every factor is present", () => {
    const result = combineRisk({
      imageMalignantRisk: 0.9,
      symptomAssessment: { flagged: true, matchedKeywords: ["bleed", "itch", "grow", "change"] },
      dateOfBirth: new Date(Date.now() - 70 * 365.25 * 24 * 60 * 60 * 1000).toISOString(),
      familyHistorySkinCancer: true,
      priorScansAtLocation: [
        { malignantRisk: 0.1, createdAt: 1000 },
        { malignantRisk: 0.5, createdAt: 2000 },
      ],
    });
    expect(result.combinedRisk).toBe(1);
  });

  it("never returns a combined risk below the image classifier's own probability", () => {
    const result = combineRisk(baseInput({ imageMalignantRisk: 0.6 }));
    expect(result.combinedRisk).toBeGreaterThanOrEqual(0.6);
  });
});

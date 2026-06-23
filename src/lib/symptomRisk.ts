// Well-known dermatology red flags (ABCDE rule + common patient-reported
// warning signs) used to flag symptom notes as concerning, independent of
// the image classifier. This is a simple keyword heuristic, not a model —
// it exists because a single photo can miss change-over-time signals
// (growth, bleeding, evolving color/shape) that the patient would notice
// but a classifier trained on static images cannot.
const CONCERNING_KEYWORDS = [
  "bleed", "bleeding", "bled",
  "itch", "itchy", "itching",
  "grow", "growing", "grown", "larger", "bigger", "enlarg",
  "change", "changed", "changing", "evolv",
  "asymmetric", "asymmetry",
  "irregular", "uneven", "border",
  "color", "colour", "darker", "black", "multi-colored", "multicolored",
  "ulcer", "ulcerated", "sore", "painful", "pain",
  "crust", "crusting", "scab",
  "raised", "new mole", "spreading",
];

export interface SymptomAssessment {
  flagged: boolean;
  matchedKeywords: string[];
}

export function assessSymptoms(notes: string | null | undefined): SymptomAssessment {
  if (!notes) return { flagged: false, matchedKeywords: [] };
  const lower = notes.toLowerCase();
  const matched = Array.from(new Set(CONCERNING_KEYWORDS.filter((kw) => lower.includes(kw))));
  return { flagged: matched.length > 0, matchedKeywords: matched };
}

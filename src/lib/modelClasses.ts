export interface LesionClass {
  code: string;
  label: string;
  malignant: boolean;
}

export const MODEL_INPUT_SIZE = 224;

export const HAM10000_CLASSES: LesionClass[] = [
  { code: "akiec", label: "Actinic keratoses / intraepithelial carcinoma", malignant: true },
  { code: "bcc", label: "Basal cell carcinoma", malignant: true },
  { code: "bkl", label: "Benign keratosis-like lesion", malignant: false },
  { code: "df", label: "Dermatofibroma", malignant: false },
  { code: "mel", label: "Melanoma", malignant: true },
  { code: "nv", label: "Melanocytic nevus (common mole)", malignant: false },
  { code: "vasc", label: "Vascular lesion", malignant: false },
];

export function malignantRiskFromProbabilities(probabilities: number[]): number {
  return HAM10000_CLASSES.reduce(
    (sum, cls, i) => sum + (cls.malignant ? probabilities[i] ?? 0 : 0),
    0
  );
}

export function topPrediction(probabilities: number[]) {
  let bestIndex = 0;
  for (let i = 1; i < probabilities.length; i++) {
    if (probabilities[i] > probabilities[bestIndex]) bestIndex = i;
  }
  return {
    cls: HAM10000_CLASSES[bestIndex],
    confidence: probabilities[bestIndex] ?? 0,
  };
}

export interface ConfidenceReasoning {
  top: { cls: LesionClass; confidence: number };
  runnerUp: { cls: LesionClass; confidence: number };
  margin: number;
  closeCall: boolean;
}

/**
 * Explains *why* the top class won: how far ahead it was of the runner-up.
 * A thin margin means the model was genuinely torn between two classes, which
 * matters for interpreting the result (e.g. top class benign, runner-up
 * malignant, margin 3pp is a very different result from a 60pp margin).
 */
export function confidenceReasoning(probabilities: number[]): ConfidenceReasoning {
  const indices = probabilities.map((_, i) => i).sort((a, b) => probabilities[b] - probabilities[a]);
  const [topIndex, runnerUpIndex] = indices;
  const top = { cls: HAM10000_CLASSES[topIndex], confidence: probabilities[topIndex] ?? 0 };
  const runnerUp = { cls: HAM10000_CLASSES[runnerUpIndex], confidence: probabilities[runnerUpIndex] ?? 0 };
  const margin = top.confidence - runnerUp.confidence;
  return { top, runnerUp, margin, closeCall: margin < 0.15 };
}

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

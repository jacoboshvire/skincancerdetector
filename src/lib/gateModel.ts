import * as tf from "@tensorflow/tfjs";
import { preprocessPixels } from "@/lib/clientModel";

// Runs before the 7-class lesion classifier to triage what was actually
// uploaded. Deliberately a separate model/pipeline from the lesion
// classifier (see scripts/train_model/train_gate.py) rather than 2 extra
// classes bolted onto that softmax -- keeps both decisions clean and
// leaves the lesion classifier's accuracy untouched.
const GATE_MODEL_URL = "/model/gate/model.json";
const GATE_INPUT_SIZE = 224;

export const GATE_CLASSES = ["not_skin", "healthy_skin", "lesion"] as const;
export type GateClass = (typeof GATE_CLASSES)[number];

export interface GateResult {
  predicted: GateClass;
  probabilities: Record<GateClass, number>;
}

let gateModelPromise: Promise<tf.LayersModel> | null = null;

export function loadGateModel(): Promise<tf.LayersModel> {
  if (!gateModelPromise) {
    gateModelPromise = tf.loadLayersModel(GATE_MODEL_URL).catch((err) => {
      gateModelPromise = null;
      throw err;
    });
  }
  return gateModelPromise;
}

export async function isGateModelAvailable(): Promise<boolean> {
  try {
    const res = await fetch(GATE_MODEL_URL, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function classifyGate(
  model: tf.LayersModel,
  image: HTMLImageElement
): Promise<GateResult> {
  const probs = tf.tidy(() => {
    const pixels = tf.browser.fromPixels(image).toFloat();
    const resized = tf.image.resizeBilinear(pixels, [GATE_INPUT_SIZE, GATE_INPUT_SIZE]);
    // Gate model was trained with mobilenetv2-style [-1, 1] scaling
    // (see train_gate.py) regardless of which lesion model is selected.
    const normalized = preprocessPixels(resized, "mobilenet");
    const batched = normalized.expandDims(0);
    return model.predict(batched) as tf.Tensor;
  });
  const data = await probs.data();
  probs.dispose();

  let bestIndex = 0;
  for (let i = 1; i < data.length; i++) {
    if (data[i] > data[bestIndex]) bestIndex = i;
  }

  return {
    predicted: GATE_CLASSES[bestIndex],
    probabilities: {
      not_skin: data[0],
      healthy_skin: data[1],
      lesion: data[2],
    },
  };
}

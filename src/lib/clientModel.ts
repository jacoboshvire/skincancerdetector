import * as tf from "@tensorflow/tfjs";
import { MODEL_INPUT_SIZE } from "@/lib/modelClasses";

const MODEL_URL = "/model/model.json";

let modelPromise: Promise<tf.LayersModel> | null = null;

export function loadModel(): Promise<tf.LayersModel> {
  if (!modelPromise) {
    modelPromise = tf.loadLayersModel(MODEL_URL).catch((err) => {
      modelPromise = null;
      throw err;
    });
  }
  return modelPromise;
}

export async function isModelAvailable(): Promise<boolean> {
  try {
    const res = await fetch(MODEL_URL, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

export async function predictFromImage(
  model: tf.LayersModel,
  image: HTMLImageElement
): Promise<number[]> {
  const probs = tf.tidy(() => {
    const pixels = tf.browser.fromPixels(image).toFloat();
    const resized = tf.image.resizeBilinear(pixels, [MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
    const normalized = resized.div(127.5).sub(1); // mobilenet_v2-style [-1, 1] scaling
    const batched = normalized.expandDims(0);
    return model.predict(batched) as tf.Tensor;
  });
  const data = await probs.data();
  probs.dispose();
  return Array.from(data);
}

import * as tf from "@tensorflow/tfjs";
import { MODEL_INPUT_SIZE } from "@/lib/modelClasses";
import { getModelInfo, Preprocessing } from "@/lib/modelRegistry";

const modelCache = new Map<string, Promise<tf.LayersModel>>();

export function loadModel(modelId: string): Promise<tf.LayersModel> {
  let cached = modelCache.get(modelId);
  if (!cached) {
    const { url } = getModelInfo(modelId);
    cached = tf.loadLayersModel(url).catch((err) => {
      modelCache.delete(modelId);
      throw err;
    });
    modelCache.set(modelId, cached);
  }
  return cached;
}

export async function isModelAvailable(modelId: string): Promise<boolean> {
  try {
    const { url } = getModelInfo(modelId);
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

function preprocessPixels(pixels: tf.Tensor3D, mode: Preprocessing): tf.Tensor3D {
  if (mode === "mobilenet") {
    return pixels.div(127.5).sub(1) as tf.Tensor3D; // [-1, 1]
  }
  return pixels; // efficientnet: raw [0, 255], model has built-in rescaling
}

export async function predictFromImage(
  model: tf.LayersModel,
  image: HTMLImageElement,
  modelId: string
): Promise<number[]> {
  const { preprocessing } = getModelInfo(modelId);
  const probs = tf.tidy(() => {
    const pixels = tf.browser.fromPixels(image).toFloat();
    const resized = tf.image.resizeBilinear(pixels, [MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
    const normalized = preprocessPixels(resized, preprocessing);
    const batched = normalized.expandDims(0);
    return model.predict(batched) as tf.Tensor;
  });
  const data = await probs.data();
  probs.dispose();
  return Array.from(data);
}

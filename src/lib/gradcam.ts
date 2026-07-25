import * as tf from "@tensorflow/tfjs";
import { MODEL_INPUT_SIZE } from "@/lib/modelClasses";
import { getModelInfo } from "@/lib/modelRegistry";
import { preprocessPixels } from "@/lib/clientModel";

// Grad-CAM: highlights which regions of the uploaded photo pushed the model
// toward its predicted class, by weighting the last convolutional layer's
// feature maps by how much each channel's activation affects the class
// score. Both shipped backbones (MobileNetV2, EfficientNetB0) are exported
// as a nested Keras "Functional" model wrapped inside an outer
// Input -> backbone -> GlobalAveragePooling2D -> Dropout -> Dense model (see
// convert_to_tfjs.py), so the last conv layer lives inside that nested
// backbone rather than at the top level — we search one level down for it.
interface LayerLike {
  name: string;
  outputShape: unknown;
  output: tf.SymbolicTensor | tf.SymbolicTensor[];
}

interface ContainerLike {
  layers: LayerLike[];
  inputs: tf.SymbolicTensor[];
}

function isRank4Shape(shape: unknown): shape is (number | null)[] {
  return (
    Array.isArray(shape) &&
    shape.length === 4 &&
    shape.every((v) => v === null || typeof v === "number")
  );
}

function findConvContainer(model: tf.LayersModel): ContainerLike {
  for (const layer of model.layers) {
    const candidate = layer as unknown as Partial<ContainerLike>;
    if (Array.isArray(candidate.layers) && candidate.layers.length > 20) {
      return candidate as ContainerLike;
    }
  }
  return model as unknown as ContainerLike;
}

function findLastConvLayer(container: ContainerLike): LayerLike {
  let found: LayerLike | null = null;
  for (const layer of container.layers) {
    if (isRank4Shape(layer.outputShape)) found = layer;
  }
  if (!found) {
    throw new Error("Could not locate a convolutional layer for Grad-CAM");
  }
  return found;
}

interface GradSubModels {
  baseModel: tf.LayersModel;
  headModel: tf.LayersModel;
}

const gradModelCache = new Map<string, GradSubModels>();

function getGradSubModels(model: tf.LayersModel, modelId: string): GradSubModels {
  const cached = gradModelCache.get(modelId);
  if (cached) return cached;

  const container = findConvContainer(model);
  const lastConv = findLastConvLayer(container);
  const convOutput = lastConv.output as tf.SymbolicTensor;

  // eslint-disable-next-line no-console
  console.log("[gradcam-debug] container === model:", container === (model as unknown as ContainerLike));
  // eslint-disable-next-line no-console
  console.log("[gradcam-debug] container.layers.length:", container.layers.length);
  // eslint-disable-next-line no-console
  console.log("[gradcam-debug] container.inputs:", (container as unknown as { inputs?: unknown }).inputs);
  const cInputs = (container as unknown as { inputs?: tf.SymbolicTensor[] }).inputs;
  if (cInputs) {
    // eslint-disable-next-line no-console
    console.log(
      "[gradcam-debug] container.inputs sourceLayer names:",
      cInputs.map((t) => t.sourceLayer?.name)
    );
  }
  // eslint-disable-next-line no-console
  console.log("[gradcam-debug] lastConv name/class:", lastConv.name, (lastConv as unknown as { getClassName?: () => string }).getClassName?.());
  // eslint-disable-next-line no-console
  console.log("[gradcam-debug] convOutput sourceLayer name:", convOutput.sourceLayer?.name);
  // eslint-disable-next-line no-console
  console.log(
    "[gradcam-debug] model.layers top-level names:",
    model.layers.map((l) => l.name)
  );

  // convOutput lives inside the nested backbone's own subgraph, rooted at the
  // backbone's own internal Input node -- not the outer model's Input. Slicing
  // from `model.inputs` fails with "Graph disconnected" because tfjs can't
  // trace across that model-as-layer boundary. `container.inputs` stays
  // entirely within the nested subgraph, which is valid; since nothing but
  // the outer Input feeds the backbone, running the same preprocessed tensor
  // through baseModel gives the same activations as slicing the outer model
  // would have.
  const baseModel = tf.model({ inputs: container.inputs, outputs: convOutput });
  const headModel = tf.model({ inputs: convOutput, outputs: model.output as tf.SymbolicTensor });

  const built = { baseModel, headModel };
  gradModelCache.set(modelId, built);
  return built;
}

function jetColor(v: number): [number, number, number] {
  // Cheap black -> red -> yellow heat ramp, no external colormap dependency.
  const r = Math.round(255 * Math.min(1, v * 2));
  const g = Math.round(255 * Math.max(0, v * 2 - 1));
  return [r, g, 0];
}

function renderHeatmapOverlay(
  values: Float32Array | Int32Array | Uint8Array,
  w: number,
  h: number,
  image: HTMLImageElement,
  opacity: number
): HTMLCanvasElement {
  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const sctx = small.getContext("2d")!;
  const imgData = sctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = values[i];
    const [r, g, b] = jetColor(v);
    imgData.data[i * 4] = r;
    imgData.data[i * 4 + 1] = g;
    imgData.data[i * 4 + 2] = b;
    imgData.data[i * 4 + 3] = Math.round(v * 255 * opacity);
  }
  sctx.putImageData(imgData, 0, 0);

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function computeGradCam(
  model: tf.LayersModel,
  image: HTMLImageElement,
  modelId: string,
  classIndex: number,
  opacity = 0.55
): Promise<HTMLCanvasElement> {
  const { preprocessing } = getModelInfo(modelId);
  const { baseModel, headModel } = getGradSubModels(model, modelId);

  const input = tf.tidy(() => {
    const pixels = tf.browser.fromPixels(image).toFloat();
    const resized = tf.image.resizeBilinear(pixels, [MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
    const normalized = preprocessPixels(resized, preprocessing);
    return normalized.expandDims(0) as tf.Tensor4D;
  });

  const convOutput = tf.tidy(() => baseModel.predict(input) as tf.Tensor4D);

  const gradFn = tf.grad((x: tf.Tensor) => {
    const preds = headModel.predict(x) as tf.Tensor;
    return preds.gather([classIndex], 1).sum();
  });
  const grads = gradFn(convOutput) as tf.Tensor4D;

  const heatmap = tf.tidy(() => {
    const pooledGrads = grads.mean([0, 1, 2]);
    const channels = convOutput.shape[3] as number;
    const weighted = (convOutput.squeeze([0]) as tf.Tensor3D).mul(
      pooledGrads.reshape([1, 1, channels])
    );
    const summed = weighted.sum(-1) as tf.Tensor2D;
    const relued = summed.relu();
    const maxVal = relued.max();
    return relued.div(maxVal.add(1e-8)) as tf.Tensor2D;
  });

  const [h, w] = heatmap.shape;
  const values = await heatmap.data();

  input.dispose();
  convOutput.dispose();
  grads.dispose();
  heatmap.dispose();

  return renderHeatmapOverlay(values, w, h, image, opacity);
}

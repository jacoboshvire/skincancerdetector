export type Preprocessing = "mobilenet" | "efficientnet";

export interface ModelInfo {
  id: string;
  label: string;
  description: string;
  url: string;
  /**
   * How raw 0-255 pixels must be transformed before being fed to this
   * model, or predictions will be garbage:
   *   - "mobilenet": scaled to [-1, 1] (pixel/127.5 - 1), matching train.py.
   *   - "efficientnet": (pixel/255 - mean) / var. EfficientNetB0's built-in
   *     Rescaling/Normalization/multiply layers aren't portable to
   *     tfjs-layers (it throws "Unknown layer: Normalization"), so
   *     convert_to_tfjs.py strips them from the exported graph and this
   *     replicates the equivalent closed-form transform client-side. See
   *     strip_efficientnet_preprocessing() in convert_to_tfjs.py.
   */
  preprocessing: Preprocessing;
}

export const MODEL_REGISTRY: ModelInfo[] = [
  {
    id: "mobilenetv2",
    label: "MobileNetV2",
    description: "Lightweight, fastest in-browser inference.",
    url: "/model/mobilenetv2/model.json",
    preprocessing: "mobilenet",
  },
  {
    id: "efficientnetb0",
    label: "EfficientNetB0",
    description: "Larger backbone, typically higher accuracy.",
    url: "/model/efficientnetb0/model.json",
    preprocessing: "efficientnet",
  },
];

export const DEFAULT_MODEL_ID = MODEL_REGISTRY[0].id;

export function getModelInfo(id: string): ModelInfo {
  return MODEL_REGISTRY.find((m) => m.id === id) ?? MODEL_REGISTRY[0];
}

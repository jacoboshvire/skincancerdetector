"""
Converts a trained Keras model (model_<arch>.h5) into the TensorFlow.js
layers format expected by the app at public/model/<arch>/.

Usage:
    MODEL_ARCH=mobilenetv2 python convert_to_tfjs.py   (default)
    MODEL_ARCH=efficientnetb0 python convert_to_tfjs.py
"""
import json
import os

# Must match train.py: model_<arch>.h5 was saved under legacy Keras 2
# (tf_keras), so it must also be loaded under tf_keras here, or
# InputLayer/graph config parsing breaks (see the comment in train.py).
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

from pathlib import Path

import numpy as np
import tensorflow as tf
import tensorflowjs as tfjs

MODEL_ARCH = os.environ.get("MODEL_ARCH", "mobilenetv2").lower()

HERE = Path(__file__).parent
MODEL_PATH = HERE / f"model_{MODEL_ARCH}.h5"
OUTPUT_DIR = HERE.parent.parent / "public" / "model" / MODEL_ARCH

# tf.keras.applications.EfficientNetB0's built-in preprocessing is implemented
# with Rescaling + Normalization + a TFOpLambda multiply, none of which
# tfjs-layers' browser-side deserializer can load (it throws "Unknown layer:
# Normalization" — Normalization and TFOpLambda are not ported to TF.js).
# These three layers strip down to a single closed-form elementwise transform
# (verified numerically to match within float32 precision, ~3e-7 max diff):
#   x = (pixel / 255 - IMAGENET_MEAN) / IMAGENET_VAR
# src/lib/clientModel.ts replicates this exact formula for the "efficientnet"
# preprocessing mode, so it MUST stay in sync with the constants below.
EFFICIENTNET_PREPROCESSING_LAYERS = {"rescaling", "normalization", "tf.math.multiply"}


def strip_efficientnet_preprocessing(model: tf.keras.Model) -> tf.keras.Model:
    """
    Rebuilds `model`'s nested EfficientNetB0 backbone with the unsupported
    preprocessing layers removed from the graph (not just neutralized —
    tfjs's deserializer rejects the layer *class*, regardless of its
    weights), rewiring the first real backbone layer to take the model
    Input directly. All other layers keep their fine-tuned weights,
    transferred by name. The model must then be fed pixels already
    preprocessed with the closed-form formula above (instead of raw
    0-255), since the layers that used to do that internally are gone.
    """
    backbone = model.get_layer("efficientnetb0")
    config = backbone.get_config()
    input_layer_name = config["input_layers"][0][0]

    new_layers = [l for l in config["layers"] if l["name"] not in EFFICIENTNET_PREPROCESSING_LAYERS]
    for layer in new_layers:
        for node in layer.get("inbound_nodes", []):
            for entry in node:
                if isinstance(entry, list) and entry and entry[0] in EFFICIENTNET_PREPROCESSING_LAYERS:
                    entry[0] = input_layer_name
                    entry[1] = 0
                    entry[2] = 0
    config["layers"] = new_layers
    new_backbone = tf.keras.Model.from_config(config)

    for layer in new_backbone.layers:
        try:
            orig_layer = backbone.get_layer(layer.name)
        except ValueError:
            continue
        if orig_layer.get_weights():
            layer.set_weights(orig_layer.get_weights())

    inputs = tf.keras.Input(shape=(224, 224, 3))
    x = new_backbone(inputs, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(model.get_layer("dropout").rate)(x)
    outputs = tf.keras.layers.Dense(7, activation="softmax")(x)
    new_model = tf.keras.Model(inputs, outputs)
    new_model.layers[-1].set_weights(model.get_layer("dense").get_weights())

    # Sanity-check equivalence before handing back a model we're about to ship.
    rng = np.random.default_rng(0)
    test_img = rng.uniform(0, 255, (2, 224, 224, 3)).astype("float32")
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    var = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    manual_input = (test_img / 255.0 - mean) / var
    orig_pred = model.predict(test_img, verbose=0)
    new_pred = new_model.predict(manual_input, verbose=0)
    max_diff = float(np.abs(orig_pred - new_pred).max())
    if max_diff > 1e-3:
        raise RuntimeError(
            f"EfficientNetB0 preprocessing-strip surgery diverged from the original "
            f"model (max abs diff {max_diff}); refusing to export a silently broken model."
        )
    print(f"Stripped preprocessing layers from EfficientNetB0 backbone (max pred diff: {max_diff:.2e})")
    return new_model


def fix_keras3_input_layer_config(model_json_path: Path) -> None:
    """
    TF 2.16's default Keras 3 saves InputLayer config with a "batch_shape" key.
    The tfjs.js runtime's deserializer only understands the older Keras 2 key
    "batch_input_shape", so without this fix tf.loadLayersModel() throws
    "An InputLayer should be passed either a batchInputShape or an inputShape"
    in the browser. Rewrite every InputLayer config in place (the top-level
    model and any nested submodels, e.g. the backbone).
    """
    with open(model_json_path) as f:
        raw = f.read()
    if '"batch_shape"' not in raw:
        return

    data = json.loads(raw)

    def walk(node):
        if isinstance(node, dict):
            if node.get("class_name") == "InputLayer" and "batch_shape" in node.get("config", {}):
                node["config"]["batch_input_shape"] = node["config"].pop("batch_shape")
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    walk(data["modelTopology"])
    with open(model_json_path, "w") as f:
        json.dump(data, f)
    print(f"Patched Keras 3 InputLayer config (batch_shape -> batch_input_shape) in {model_json_path}")


def main():
    if not MODEL_PATH.exists():
        raise FileNotFoundError(f"Missing {MODEL_PATH}. Run `MODEL_ARCH={MODEL_ARCH} python train.py` first.")

    model = tf.keras.models.load_model(MODEL_PATH)
    if MODEL_ARCH == "efficientnetb0":
        model = strip_efficientnet_preprocessing(model)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    tfjs.converters.save_keras_model(model, str(OUTPUT_DIR))
    fix_keras3_input_layer_config(OUTPUT_DIR / "model.json")
    print(f"Wrote TensorFlow.js model to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()

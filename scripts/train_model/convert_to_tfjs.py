"""
Converts the trained Keras model (model.h5) into the TensorFlow.js layers
format expected by the app at public/model/.

Usage:
    python convert_to_tfjs.py
"""
import json
import os

# Must match train.py: model.h5 was saved under legacy Keras 2 (tf_keras), so
# it must also be loaded under tf_keras here, or InputLayer/graph config
# parsing breaks (see the comment in train.py for why).
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

from pathlib import Path

import tensorflow as tf
import tensorflowjs as tfjs

HERE = Path(__file__).parent
MODEL_PATH = HERE / "model.h5"
OUTPUT_DIR = HERE.parent.parent / "public" / "model"


def fix_keras3_input_layer_config(model_json_path: Path) -> None:
    """
    TF 2.16's default Keras 3 saves InputLayer config with a "batch_shape" key.
    The tfjs.js runtime's deserializer only understands the older Keras 2 key
    "batch_input_shape", so without this fix tf.loadLayersModel() throws
    "An InputLayer should be passed either a batchInputShape or an inputShape"
    in the browser. Rewrite every InputLayer config in place (the top-level
    model and any nested submodels, e.g. the MobileNetV2 base).
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
        raise FileNotFoundError(f"Missing {MODEL_PATH}. Run train.py first.")

    model = tf.keras.models.load_model(MODEL_PATH)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    tfjs.converters.save_keras_model(model, str(OUTPUT_DIR))
    fix_keras3_input_layer_config(OUTPUT_DIR / "model.json")
    print(f"Wrote TensorFlow.js model to {OUTPUT_DIR}")


if __name__ == "__main__":
    main()

"""
Transfer-learning training script: fine-tunes a pretrained ImageNet backbone
on the HAM10000 skin lesion dataset, using manifest_train.csv / manifest_val.csv
produced by prepare_data.py.

Preprocessing here MUST match src/lib/clientModel.ts on the frontend, and
differs per architecture (see MODEL_ARCHS below):
  - mobilenetv2: pixels resized to 224x224 and scaled to [-1, 1] (pixel/127.5 - 1)
  - efficientnetb0: pixels resized to 224x224, left in raw [0, 255] range
    (EfficientNetB0 has built-in Rescaling/Normalization layers, so external
    scaling here would double-normalize and produce garbage predictions)

Usage:
    MODEL_ARCH=mobilenetv2 python train.py   (default)
    MODEL_ARCH=efficientnetb0 python train.py
Output:
    model_<arch>.h5 in this directory (consumed by convert_to_tfjs.py)
"""
import os

# TF 2.16+ defaults to Keras 3, which serializes model configs (InputLayer
# batch_shape, functional-graph inbound_nodes) in a format the tfjs.js
# runtime's loadLayersModel() cannot parse. Training under legacy Keras 2
# (tf_keras) avoids the mismatch entirely rather than patching the JSON
# after the fact. Must be set before the first `import tensorflow`.
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

from pathlib import Path

import numpy as np
import pandas as pd
import tensorflow as tf
from PIL import Image, ImageDraw, ImageFilter
from sklearn.utils.class_weight import compute_class_weight

# Some tensorflow-metal / TF version combos hang during the validation phase
# on Apple Silicon GPUs. Set FORCE_CPU=1 to disable the GPU device as a
# workaround if training stalls indefinitely after the first epoch's steps.
if os.environ.get("FORCE_CPU") == "1":
    tf.config.set_visible_devices([], "GPU")

IMG_SIZE = 224
BATCH_SIZE = 32
NUM_CLASSES = 7
HEAD_EPOCHS = 5
FINE_TUNE_EPOCHS = 10

MODEL_ARCH = os.environ.get("MODEL_ARCH", "mobilenetv2").lower()

# Per-architecture config: the Keras application class to use as the frozen
# backbone, whether the client/training pipeline must manually rescale
# pixels to [-1, 1] (MobileNetV2-style) or leave them raw 0-255 (EfficientNet
# has its own built-in Rescaling+Normalization layers), and roughly what
# fraction of the backbone to keep frozen during the fine-tuning pass.
MODEL_ARCHS = {
    "mobilenetv2": {
        "build_base": tf.keras.applications.MobileNetV2,
        "rescale": True,
        "fine_tune_frozen_fraction": 0.65,
    },
    "efficientnetb0": {
        "build_base": tf.keras.applications.EfficientNetB0,
        "rescale": False,
        "fine_tune_frozen_fraction": 0.65,
    },
}

if MODEL_ARCH not in MODEL_ARCHS:
    raise ValueError(f"Unknown MODEL_ARCH={MODEL_ARCH!r}; choose one of {list(MODEL_ARCHS)}")

ARCH_CONFIG = MODEL_ARCHS[MODEL_ARCH]

HERE = Path(__file__).parent

# Real dermoscopic photos are often partly obscured by body hair; a model
# trained only on clean images tends to either get distracted by hair
# strands (treating them as texture/edges relevant to the lesion) or perform
# worse specifically on hairy images, since it never saw that during
# training. Rather than trying to strip hair out at inference time (which
# would require a matching preprocessing step in the browser client, and get
# the mismatch-prone "must stay in sync with clientModel.ts" problem the
# module docstring above already warns about), we do the opposite: draw
# synthetic hair onto a portion of the *training* images so the model
# learns to see past it. This is the same trick several top ISIC-challenge
# solutions used.
HAIR_AUGMENT_PROB = 0.5
HAIR_MAX_STRANDS = 6


def _draw_synthetic_hair(image_np: np.ndarray) -> np.ndarray:
    if np.random.rand() > HAIR_AUGMENT_PROB:
        return image_np.astype(np.float32)

    img = Image.fromarray(np.clip(image_np, 0, 255).astype(np.uint8))
    draw = ImageDraw.Draw(img)
    h, w = image_np.shape[:2]

    for _ in range(np.random.randint(1, HAIR_MAX_STRANDS + 1)):
        # Real hairs are near-black to dark-brown and much thinner than any
        # lesion feature; a handful of short straight segments chained at
        # slightly bent angles reads as a curved strand without needing a
        # true curve-drawing primitive.
        color = tuple(int(c) for c in np.random.randint(0, 50, size=3))
        stroke_width = np.random.randint(1, 3)
        x, y = np.random.uniform(0, w), np.random.uniform(0, h)
        angle = np.random.uniform(0, 2 * np.pi)
        segment_len = np.random.uniform(0.05, 0.15) * max(w, h)
        points = [(x, y)]
        for _ in range(np.random.randint(4, 10)):
            angle += np.random.uniform(-0.4, 0.4)
            x = x + segment_len * np.cos(angle)
            y = y + segment_len * np.sin(angle)
            points.append((x, y))
        draw.line(points, fill=color, width=int(stroke_width))

    return np.array(img).astype(np.float32)


def add_synthetic_hair(image: tf.Tensor) -> tf.Tensor:
    out = tf.numpy_function(_draw_synthetic_hair, [image], tf.float32)
    out.set_shape(image.shape)
    return out


# Real photos submitted through a phone camera commonly have uneven lighting:
# a shadow from the hand/phone itself, a bright flash glare, or a vignette
# from the lens. None of that should change the diagnosis, so we draw soft
# dark or bright blobs onto training images the same way HAIR_AUGMENT_PROB
# does for hair -- teaching the model the lesion's actual features matter,
# not incidental lighting.
SHADOW_AUGMENT_PROB = 0.4
SHADOW_MAX_REGIONS = 2


def _draw_shadow_or_glare(image_np: np.ndarray) -> np.ndarray:
    if np.random.rand() > SHADOW_AUGMENT_PROB:
        return image_np.astype(np.float32)

    h, w = image_np.shape[:2]
    img = Image.fromarray(np.clip(image_np, 0, 255).astype(np.uint8)).convert("RGBA")
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    for _ in range(np.random.randint(1, SHADOW_MAX_REGIONS + 1)):
        # Dark (shadow/occlusion) most of the time, occasionally bright
        # (flash glare) -- shadows are the far more common real-world case.
        is_glare = np.random.rand() < 0.25
        color = (255, 255, 255) if is_glare else (0, 0, 0)
        alpha = np.random.randint(50, 140)

        cx, cy = np.random.uniform(0, w), np.random.uniform(0, h)
        rw = np.random.uniform(0.25, 0.65) * w
        rh = np.random.uniform(0.25, 0.65) * h
        draw.ellipse([cx - rw / 2, cy - rh / 2, cx + rw / 2, cy + rh / 2], fill=(*color, alpha))

    # Blur so the region has a soft gradient edge like real lighting, rather
    # than a hard-edged shape.
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=max(w, h) * 0.06))
    composited = Image.alpha_composite(img, overlay).convert("RGB")
    return np.array(composited).astype(np.float32)


def add_shadow_or_glare(image: tf.Tensor) -> tf.Tensor:
    out = tf.numpy_function(_draw_shadow_or_glare, [image], tf.float32)
    out.set_shape(image.shape)
    return out


def load_manifest(name: str) -> pd.DataFrame:
    return pd.read_csv(HERE / name)


def make_dataset(df: pd.DataFrame, training: bool) -> tf.data.Dataset:
    paths = df["path"].to_numpy()
    labels = df["label"].to_numpy()

    ds = tf.data.Dataset.from_tensor_slices((paths, labels))

    def load_image(path, label):
        image = tf.io.read_file(path)
        image = tf.io.decode_jpeg(image, channels=3)
        image = tf.image.resize(image, [IMG_SIZE, IMG_SIZE])
        image = tf.cast(image, tf.float32)
        if training:
            # Everything below must run in raw 0-255 space, before either
            # architecture's rescale, so hair/shadow/JPEG-artifact values
            # mean the same thing regardless of MODEL_ARCH.
            image = add_synthetic_hair(image)
            image = add_shadow_or_glare(image)
            # Cheap stand-in for general camera/upload interference (motion
            # blur, low-quality compression): degrade JPEG quality on some
            # images. tf.random (not np.random) so this is re-evaluated per
            # example rather than baked in once at graph-trace time, and
            # tf.cond keeps the shape/dtype consistent between branches.
            image = tf.cond(
                tf.random.uniform(()) < 0.3,
                lambda: tf.cast(
                    tf.image.random_jpeg_quality(tf.cast(tf.clip_by_value(image, 0, 255), tf.uint8), 30, 80),
                    tf.float32,
                ),
                lambda: image,
            )
        if ARCH_CONFIG["rescale"]:
            image = (image / 127.5) - 1.0  # match client-side normalization
        return image, label

    ds = ds.map(load_image, num_parallel_calls=tf.data.AUTOTUNE)

    if training:
        ds = ds.shuffle(2048)

        def augment(image, label):
            image = tf.image.random_flip_left_right(image)
            image = tf.image.random_flip_up_down(image)
            image = tf.image.random_brightness(image, 0.1)
            image = tf.image.random_contrast(image, 0.9, 1.1)
            return image, label

        ds = ds.map(augment, num_parallel_calls=tf.data.AUTOTUNE)

    ds = ds.batch(BATCH_SIZE).prefetch(tf.data.AUTOTUNE)
    return ds


CHECKPOINT_PATH = HERE / f"checkpoint_{MODEL_ARCH}.h5"
STATE_PATH = HERE / f"checkpoint_{MODEL_ARCH}_state.json"


class SaveCheckpoint(tf.keras.callbacks.Callback):
    """
    Saves the model + a small JSON sidecar (phase, epochs completed) after
    every epoch. A 95k-image CPU training run takes hours; without this, a
    crash anywhere in a 15-epoch run throws away all of it. On restart,
    main() reloads the checkpoint and resumes with `initial_epoch` rather
    than rebuilding from scratch.
    """

    def __init__(self, phase: str):
        super().__init__()
        self.phase = phase

    def on_epoch_end(self, epoch, logs=None):
        self.model.save(CHECKPOINT_PATH)
        STATE_PATH.write_text(json.dumps({"phase": self.phase, "epoch": epoch + 1}))
        print(f"[checkpoint] saved phase={self.phase} epoch={epoch + 1}")


def find_backbone_layer(model: tf.keras.Model) -> tf.keras.Model:
    for layer in model.layers:
        if isinstance(layer, tf.keras.Model):
            return layer
    raise ValueError("Could not find nested backbone layer in loaded checkpoint")


def build_model() -> tf.keras.Model:
    base = ARCH_CONFIG["build_base"](
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )
    base.trainable = False

    inputs = tf.keras.Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x = base(inputs, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(NUM_CLASSES, activation="softmax")(x)
    model = tf.keras.Model(inputs, outputs)
    return model, base


def main():
    print(f"=== Training architecture: {MODEL_ARCH} ===")

    train_df = load_manifest("manifest_train.csv")
    val_df = load_manifest("manifest_val.csv")

    train_ds = make_dataset(train_df, training=True)
    val_ds = make_dataset(val_df, training=False)

    class_weights_arr = compute_class_weight(
        class_weight="balanced",
        classes=np.arange(NUM_CLASSES),
        y=train_df["label"].to_numpy(),
    )
    class_weight = {i: w for i, w in enumerate(class_weights_arr)}
    print("Class weights (balancing HAM10000's heavy skew toward nv):", class_weight)

    model, base = build_model()
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.summary()

    print(f"\n--- Training classifier head for {HEAD_EPOCHS} epochs (base frozen) ---")
    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=HEAD_EPOCHS,
        class_weight=class_weight,
    )

    fine_tune_at_layer = int(len(base.layers) * ARCH_CONFIG["fine_tune_frozen_fraction"])
    print(f"\n--- Fine-tuning top layers of {MODEL_ARCH} for {FINE_TUNE_EPOCHS} epochs "
          f"(unfreezing layers {fine_tune_at_layer}-{len(base.layers)}) ---")
    base.trainable = True
    for layer in base.layers[:fine_tune_at_layer]:
        layer.trainable = False

    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-5),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.fit(
        train_ds,
        validation_data=val_ds,
        epochs=FINE_TUNE_EPOCHS,
        class_weight=class_weight,
    )

    out_path = HERE / f"model_{MODEL_ARCH}.h5"
    model.save(out_path)
    print(f"\nSaved trained model to {out_path}")


if __name__ == "__main__":
    main()

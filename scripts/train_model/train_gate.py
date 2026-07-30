"""
Trains a small "gate" model that triages an uploaded photo into one of 3
categories before it ever reaches the 7-class lesion classifier:
  0 = not_skin     (some other photo entirely -- object, document, scenery)
  1 = healthy_skin  (real skin, but no lesion -- nothing to classify)
  2 = lesion        (a skin lesion photo -- hand off to the main classifier)

This is a deliberately separate model/pipeline from train.py: mixing "is
this even a lesion photo" into the same softmax as fine-grained diagnosis
would dilute both decisions. The main classifier's accuracy is untouched;
this just runs first and blocks bad inputs.

Data sources (see download_extra_isic.py's sibling scripts and
generate_healthy_skin_crops.py for how each is produced):
  - not_skin: Imagenette (data/imagenette/imagenette2-320/{train,val}/*/*),
    a standard 10-class subset of ImageNet -- ordinary object photos with no
    connection to skin at all.
  - healthy_skin: corner crops of wide clinical (non-dermoscopic) photos
    already in this project (data/healthy_skin_crops/*.jpg) -- a heuristic,
    not expert-verified ground truth (see generate_healthy_skin_crops.py's
    docstring). No public "healthy skin" dataset exists.
  - lesion: a random sample of the same combined lesion manifest train.py
    uses (manifest_train.csv / manifest_val.csv), across all 7 diagnosis
    classes -- the gate only needs to know "this is a lesion", not which one.

Preprocessing matches train.py's mobilenetv2 path (resize 224x224, scale to
[-1, 1]) so src/lib/clientModel.ts can reuse the exact same code path for
both models.

Usage:
    python train_gate.py
Output:
    model_gate.h5 in this directory (consumed by convert_to_tfjs.py via
    MODEL_ARCH=gate)
"""
import os

os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

from pathlib import Path

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.utils.class_weight import compute_class_weight

if os.environ.get("FORCE_CPU") == "1":
    tf.config.set_visible_devices([], "GPU")

IMG_SIZE = 224
BATCH_SIZE = 32
NUM_CLASSES = 3
HEAD_EPOCHS = 4
FINE_TUNE_EPOCHS = 6
FINE_TUNE_FROZEN_FRACTION = 0.65

CLASS_NAMES = ["not_skin", "healthy_skin", "lesion"]

HERE = Path(__file__).parent
DATA_DIR = HERE / "data"
IMAGENETTE_DIR = DATA_DIR / "imagenette" / "imagenette2-320"
HEALTHY_SKIN_DIR = DATA_DIR / "healthy_skin_crops"

# Caps so the gate's 3 classes stay roughly balanced rather than being
# dominated by whichever source happens to be largest (the lesion manifest
# is huge, and generate_healthy_skin_crops.py produces 4 near-duplicate
# corner crops per source photo).
LESION_SAMPLE_CAP = 15000
HEALTHY_SKIN_SAMPLE_CAP = 15000


def build_manifest() -> pd.DataFrame:
    rows = []

    not_skin_paths = list(IMAGENETTE_DIR.glob("train/*/*.JPEG")) + list(IMAGENETTE_DIR.glob("val/*/*.JPEG"))
    if not not_skin_paths:
        raise FileNotFoundError(
            f"No Imagenette images found under {IMAGENETTE_DIR}. "
            "Download+extract imagenette2-320.tgz there first."
        )
    rows += [(str(p), 0) for p in not_skin_paths]
    print(f"not_skin: {len(not_skin_paths)} images (Imagenette)")

    healthy_paths = list(HEALTHY_SKIN_DIR.glob("*.jpg"))
    if not healthy_paths:
        raise FileNotFoundError(
            f"No healthy-skin crops found under {HEALTHY_SKIN_DIR}. "
            "Run generate_healthy_skin_crops.py first."
        )
    rows += [(str(p), 1) for p in healthy_paths]
    print(f"healthy_skin: {len(healthy_paths)} images (corner crops)")

    lesion_train = pd.read_csv(HERE / "manifest_train.csv")
    lesion_val = pd.read_csv(HERE / "manifest_val.csv")
    lesion_paths = pd.concat([lesion_train["path"], lesion_val["path"]], ignore_index=True)
    if len(lesion_paths) > LESION_SAMPLE_CAP:
        lesion_paths = lesion_paths.sample(LESION_SAMPLE_CAP, random_state=42)
    rows += [(p, 2) for p in lesion_paths]
    print(f"lesion: {len(lesion_paths)} images (sampled from combined manifest)")

    df = pd.DataFrame(rows, columns=["path", "label"])
    return df.sample(frac=1, random_state=42).reset_index(drop=True)


def make_dataset(df: pd.DataFrame, training: bool) -> tf.data.Dataset:
    paths = df["path"].to_numpy()
    labels = df["label"].to_numpy()

    ds = tf.data.Dataset.from_tensor_slices((paths, labels))

    def load_image(path, label):
        image = tf.io.read_file(path)
        image = tf.io.decode_jpeg(image, channels=3)
        image = tf.image.resize(image, [IMG_SIZE, IMG_SIZE])
        image = tf.cast(image, tf.float32)
        image = (image / 127.5) - 1.0
        return image, label

    ds = ds.map(load_image, num_parallel_calls=tf.data.AUTOTUNE)

    if training:
        ds = ds.shuffle(4096)

        def augment(image, label):
            image = tf.image.random_flip_left_right(image)
            image = tf.image.random_brightness(image, 0.1)
            image = tf.image.random_contrast(image, 0.9, 1.1)
            return image, label

        ds = ds.map(augment, num_parallel_calls=tf.data.AUTOTUNE)

    ds = ds.batch(BATCH_SIZE).prefetch(tf.data.AUTOTUNE)
    return ds


def build_model():
    base = tf.keras.applications.MobileNetV2(
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
    df = build_manifest()
    print("\nClass distribution:")
    print(df["label"].map(dict(enumerate(CLASS_NAMES))).value_counts())

    from sklearn.model_selection import train_test_split

    train_df, val_df = train_test_split(df, test_size=0.15, random_state=42, stratify=df["label"])
    train_ds = make_dataset(train_df, training=True)
    val_ds = make_dataset(val_df, training=False)

    class_weights_arr = compute_class_weight(
        class_weight="balanced", classes=np.arange(NUM_CLASSES), y=train_df["label"].to_numpy()
    )
    class_weight = dict(enumerate(class_weights_arr))
    print("Class weights:", class_weight)

    model, base = build_model()
    model.compile(optimizer=tf.keras.optimizers.Adam(1e-3), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    model.summary()

    print(f"\n--- Training gate head for {HEAD_EPOCHS} epochs (base frozen) ---")
    model.fit(train_ds, validation_data=val_ds, epochs=HEAD_EPOCHS, class_weight=class_weight)

    fine_tune_at = int(len(base.layers) * FINE_TUNE_FROZEN_FRACTION)
    print(f"\n--- Fine-tuning top layers for {FINE_TUNE_EPOCHS} epochs (unfreezing {fine_tune_at}-{len(base.layers)}) ---")
    base.trainable = True
    for layer in base.layers[:fine_tune_at]:
        layer.trainable = False

    model.compile(optimizer=tf.keras.optimizers.Adam(1e-5), loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    model.fit(train_ds, validation_data=val_ds, epochs=FINE_TUNE_EPOCHS, class_weight=class_weight)

    out_path = HERE / "model_gate.h5"
    model.save(out_path)
    print(f"\nSaved trained gate model to {out_path}")


if __name__ == "__main__":
    main()

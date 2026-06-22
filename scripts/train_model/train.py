"""
Transfer-learning training script: fine-tunes MobileNetV2 (ImageNet weights)
on the HAM10000 skin lesion dataset, using manifest_train.csv / manifest_val.csv
produced by prepare_data.py.

Preprocessing here MUST match src/lib/clientModel.ts on the frontend:
images are resized to 224x224 and scaled to [-1, 1] (pixel/127.5 - 1).

Usage:
    python train.py
Output:
    model.h5 in this directory (consumed by convert_to_tfjs.py)
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
FINE_TUNE_AT_LAYER = 100  # unfreeze MobileNetV2 layers from this index onward

HERE = Path(__file__).parent


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


def build_model() -> tf.keras.Model:
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

    print(f"\n--- Fine-tuning top layers of MobileNetV2 for {FINE_TUNE_EPOCHS} epochs ---")
    base.trainable = True
    for layer in base.layers[:FINE_TUNE_AT_LAYER]:
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

    out_path = HERE / "model.h5"
    model.save(out_path)
    print(f"\nSaved trained model to {out_path}")


if __name__ == "__main__":
    main()

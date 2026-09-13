"""
Evaluates the trained MobileNetV2 and EfficientNetB0 lesion classifiers
against the held-out validation manifest (manifest_val.csv), printing a
classification report and confusion matrix for each architecture and writing
them out as evaluation_summary.md plus one confusion-matrix PNG per model.

Must load the .h5 files under legacy Keras 2 (tf_keras) and apply the same
per-architecture preprocessing train.py used during training (and
src/lib/clientModel.ts replicates client-side) -- see the comment in
train.py for why a mismatch here would silently produce garbage predictions.

Usage:
    python evaluate.py
Output (written to this directory):
    evaluation_summary.md
    confusion_matrix_mobilenetv2.png
    confusion_matrix_efficientnetb0.png
"""
import argparse
import os

# Must be set before the first `import tensorflow` -- see train.py.
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # headless: no display available in a terminal run
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

IMG_SIZE = 224
BATCH_SIZE = 32
NUM_CLASSES = 7
HERE = Path(__file__).parent

# Must match src/lib/modelClasses.ts (HAM10000_CLASSES) and prepare_data.py's
# CLASS_ORDER -- manifest_val.csv's "label" column is an index into this list.
CLASS_CODES = ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]
CLASS_NAMES = {
    "akiec": "Actinic keratoses / intraepithelial carcinoma",
    "bcc": "Basal cell carcinoma",
    "bkl": "Benign keratosis-like lesion",
    "df": "Dermatofibroma",
    "mel": "Melanoma",
    "nv": "Melanocytic nevus (common mole)",
    "vasc": "Vascular lesion",
}
MALIGNANT_CODES = {"akiec", "bcc", "mel"}
MALIGNANT_LABELS = [CLASS_CODES.index(c) for c in MALIGNANT_CODES]

# Per-architecture preprocessing, matching train.py's ARCH_CONFIG["rescale"]:
# mobilenetv2 needs pixels scaled to [-1, 1]; efficientnetb0's saved .h5 still
# has its built-in Rescaling/Normalization layers (only stripped later by
# convert_to_tfjs.py for the browser build), so it takes raw 0-255 pixels here.
ARCHS = {
    "mobilenetv2": {"rescale": True},
    "efficientnetb0": {"rescale": False},
}


def load_manifest(filename: str) -> pd.DataFrame:
    df = pd.read_csv(HERE / filename)
    exists = df["path"].apply(lambda p: Path(p).exists())
    missing = int((~exists).sum())
    if missing:
        print(
            f"[warn] {missing} of {len(df)} validation images referenced in "
            f"{filename} are missing on disk; skipping them."
        )
        df = df[exists].reset_index(drop=True)
    if df.empty:
        raise RuntimeError(f"No validation images found on disk in {filename} -- nothing to evaluate.")
    return df


def make_eval_dataset(df: pd.DataFrame, rescale: bool) -> tf.data.Dataset:
    paths = df["path"].to_numpy()

    def load_image(path):
        image = tf.io.read_file(path)
        image = tf.io.decode_jpeg(image, channels=3)
        image = tf.image.resize(image, [IMG_SIZE, IMG_SIZE])
        image = tf.cast(image, tf.float32)
        if rescale:
            image = (image / 127.5) - 1.0  # match client-side normalization
        return image

    ds = tf.data.Dataset.from_tensor_slices(paths)
    ds = ds.map(load_image, num_parallel_calls=tf.data.AUTOTUNE)
    ds = ds.batch(BATCH_SIZE).prefetch(tf.data.AUTOTUNE)
    return ds


def plot_confusion_matrix(cm: np.ndarray, arch: str, accuracy: float, out_path: Path) -> None:
    fig, ax = plt.subplots(figsize=(7, 6))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(len(CLASS_CODES)))
    ax.set_yticks(range(len(CLASS_CODES)))
    ax.set_xticklabels(CLASS_CODES, rotation=45, ha="right")
    ax.set_yticklabels(CLASS_CODES)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title(f"{arch} — confusion matrix (val accuracy {accuracy:.1%})")

    thresh = cm.max() / 2 if cm.max() else 0
    for i in range(cm.shape[0]):
        for j in range(cm.shape[1]):
            ax.text(
                j,
                i,
                format(cm[i, j], "d"),
                ha="center",
                va="center",
                color="white" if cm[i, j] > thresh else "black",
                fontsize=8,
            )

    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)


def evaluate_arch(arch: str, df: pd.DataFrame) -> dict:
    model_path = HERE / f"model_{arch}.h5"
    if not model_path.exists():
        raise FileNotFoundError(f"Missing {model_path}")

    print(f"\n=== Evaluating {arch} ({model_path.name}) on {len(df)} validation images ===")
    model = tf.keras.models.load_model(model_path)

    ds = make_eval_dataset(df, rescale=ARCHS[arch]["rescale"])
    probs = model.predict(ds, verbose=1)
    y_pred = np.argmax(probs, axis=1)
    y_true = df["label"].to_numpy()

    report = classification_report(
        y_true,
        y_pred,
        labels=list(range(NUM_CLASSES)),
        target_names=CLASS_CODES,
        digits=3,
        zero_division=0,
    )
    cm = confusion_matrix(y_true, y_pred, labels=list(range(NUM_CLASSES)))
    acc = accuracy_score(y_true, y_pred)
    malignant_acc = accuracy_score(np.isin(y_true, MALIGNANT_LABELS), np.isin(y_pred, MALIGNANT_LABELS))

    print(f"\n--- {arch}: classification report ---")
    print(report)
    print(f"--- {arch}: confusion matrix (rows=true, cols=pred; class order {CLASS_CODES}) ---")
    print(cm)
    print(f"--- {arch}: overall accuracy: {acc:.4f} ---")
    print(f"--- {arch}: malignant-vs-benign grouping accuracy: {malignant_acc:.4f} ---")

    png_path = HERE / f"confusion_matrix_{arch}.png"
    plot_confusion_matrix(cm, arch, acc, png_path)
    print(f"Wrote {png_path}")

    return {
        "arch": arch,
        "n": len(df),
        "accuracy": acc,
        "malignant_accuracy": malignant_acc,
        "report": report,
        "confusion_matrix": cm,
    }


def write_summary(results: list) -> None:
    lines = ["# SkinScan model evaluation", ""]
    lines.append(f"Held-out validation set: `manifest_val.csv` ({results[0]['n']} images).")
    lines.append("")
    lines.append(
        "Class order: " + ", ".join(f"`{c}` ({CLASS_NAMES[c]})" for c in CLASS_CODES) + "."
    )
    lines.append("")

    lines.append("| Model | Val accuracy | Malignant-vs-benign accuracy |")
    lines.append("|---|---|---|")
    for r in results:
        lines.append(f"| {r['arch']} | {r['accuracy']:.3%} | {r['malignant_accuracy']:.3%} |")
    lines.append("")

    for r in results:
        lines.append(f"## {r['arch']}")
        lines.append("")
        lines.append("```")
        lines.append(r["report"].rstrip())
        lines.append("```")
        lines.append("")
        lines.append(f"![confusion matrix for {r['arch']}](confusion_matrix_{r['arch']}.png)")
        lines.append("")

    (HERE / "evaluation_summary.md").write_text("\n".join(lines))
    print(f"\nWrote {HERE / 'evaluation_summary.md'}")


def main():
    df = load_manifest()
    results = [evaluate_arch(arch, df) for arch in ARCHS]
    write_summary(results)


if __name__ == "__main__":
    main()

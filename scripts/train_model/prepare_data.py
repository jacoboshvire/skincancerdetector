"""
Builds a train/validation manifest from the staged HAM10000 dataset.

Reads ./data/HAM10000_metadata.csv and locates each image across
HAM10000_images_part_1/ and HAM10000_images_part_2/, then writes
manifest_train.csv and manifest_val.csv with columns: path,label

Usage:
    python prepare_data.py
"""
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

DATA_DIR = Path(__file__).parent / "data"
METADATA_CSV = DATA_DIR / "HAM10000_metadata.csv"

# Must match the class order in src/lib/modelClasses.ts (HAM10000_CLASSES)
CLASS_ORDER = ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]


def find_image_dirs():
    candidates = [p for p in DATA_DIR.glob("HAM10000_images_part_*") if p.is_dir()]
    if not candidates:
        # Some kaggle mirrors nest a single "ham10000" image folder instead.
        candidates = [p for p in DATA_DIR.rglob("*") if p.is_dir() and "images" in p.name.lower()]
    if not candidates:
        raise FileNotFoundError(
            f"Could not find HAM10000 image directories under {DATA_DIR}. "
            "Run download_data.py first."
        )
    return candidates


def main():
    if not METADATA_CSV.exists():
        raise FileNotFoundError(f"Missing {METADATA_CSV}. Run download_data.py first.")

    df = pd.read_csv(METADATA_CSV)
    image_dirs = find_image_dirs()

    image_index = {}
    for d in image_dirs:
        for f in d.glob("*.jpg"):
            image_index[f.stem] = f

    df["path"] = df["image_id"].map(lambda iid: str(image_index.get(iid, "")))
    missing = (df["path"] == "").sum()
    if missing:
        print(f"Warning: {missing} images referenced in metadata were not found on disk; dropping them.")
    df = df[df["path"] != ""]

    df = df[df["dx"].isin(CLASS_ORDER)]
    df["label"] = df["dx"].map(CLASS_ORDER.index)

    print("Class distribution:")
    print(df["dx"].value_counts())

    train_df, val_df = train_test_split(
        df[["path", "label", "dx"]],
        test_size=0.15,
        random_state=42,
        stratify=df["dx"],
    )

    train_df[["path", "label"]].to_csv(Path(__file__).parent / "manifest_train.csv", index=False)
    val_df[["path", "label"]].to_csv(Path(__file__).parent / "manifest_val.csv", index=False)

    print(f"Wrote {len(train_df)} training rows and {len(val_df)} validation rows.")


if __name__ == "__main__":
    main()

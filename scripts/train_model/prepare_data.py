"""
Builds a train/validation manifest from the staged HAM10000 dataset, plus
BCN20000 if it's been downloaded (see download_bcn20000.py) -- combining the
two roughly triples the amount of training data per class versus HAM10000
alone.

Reads ./data/HAM10000_metadata.csv and locates each image across
HAM10000_images_part_1/ and HAM10000_images_part_2/, and (if present)
./data/bcn20000/metadata.csv + the images downloaded alongside it. Both are
mapped onto the same 7-class taxonomy and written out as manifest_train.csv
and manifest_val.csv with columns: path,label

Usage:
    python prepare_data.py
"""
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

DATA_DIR = Path(__file__).parent / "data"
HAM_METADATA_CSV = DATA_DIR / "HAM10000_metadata.csv"
BCN_DIR = DATA_DIR / "bcn20000"
BCN_METADATA_CSV = BCN_DIR / "metadata.csv"

# Must match the class order in src/lib/modelClasses.ts (HAM10000_CLASSES)
CLASS_ORDER = ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]

# Maps BCN20000's `diagnosis_3` field (the specific-diagnosis level of its
# hierarchical diagnosis_1/2/3 metadata -- NOT the flat `diagnosis` field
# some other ISIC collections use; verified directly against the actual
# downloaded metadata.csv, not just the isic-metadata package's schema docs)
# onto the 7-class HAM10000 taxonomy above. HAM10000's own class definitions
# already bundle several distinct diagnoses together -- akiec covers both
# actinic keratosis and Bowen's-disease-type squamous cell carcinoma in situ;
# bkl covers seborrheic keratosis and solar lentigo. BCN20000 has no vascular
# lesion cases at all, so `vasc` gets nothing from this source. Diagnoses
# with no reasonable HAM10000 equivalent (Scar, and anything NaN) are
# intentionally left unmapped and dropped -- see the "unmapped diagnoses"
# summary this script prints, which lists exactly what got excluded and how
# often.
ISIC_DIAGNOSIS_TO_HAM = {
    "Solar or actinic keratosis": "akiec",
    "Squamous cell carcinoma, NOS": "akiec",
    "Basal cell carcinoma": "bcc",
    "Seborrheic keratosis": "bkl",
    "Solar lentigo": "bkl",
    "Dermatofibroma": "df",
    "Melanoma, NOS": "mel",
    "Melanoma metastasis": "mel",
    "Nevus": "nv",
}


def load_ham10000() -> pd.DataFrame:
    if not HAM_METADATA_CSV.exists():
        print(f"HAM10000 not found at {HAM_METADATA_CSV} (run download_data.py to include it) -- skipping.")
        return pd.DataFrame(columns=["path", "dx", "source"])

    df = pd.read_csv(HAM_METADATA_CSV)

    image_dirs = [p for p in DATA_DIR.glob("HAM10000_images_part_*") if p.is_dir()]
    if not image_dirs:
        # Some kaggle mirrors nest a single "ham10000" image folder instead.
        image_dirs = [p for p in DATA_DIR.rglob("*") if p.is_dir() and "images" in p.name.lower()]
    if not image_dirs:
        raise FileNotFoundError(
            f"Found {HAM_METADATA_CSV} but no HAM10000 image directories under {DATA_DIR}. "
            "Run download_data.py first."
        )

    image_index = {}
    for d in image_dirs:
        for f in d.glob("*.jpg"):
            image_index[f.stem] = f

    df["path"] = df["image_id"].map(lambda iid: str(image_index.get(iid, "")))
    missing = (df["path"] == "").sum()
    if missing:
        print(f"HAM10000: {missing} images referenced in metadata were not found on disk; dropping them.")
    df = df[df["path"] != ""]

    df = df[df["dx"].isin(CLASS_ORDER)]
    df["source"] = "ham10000"
    return df[["path", "dx", "source"]]


def load_bcn20000() -> pd.DataFrame:
    if not BCN_METADATA_CSV.exists():
        print(f"BCN20000 not found at {BCN_METADATA_CSV} (run download_bcn20000.py to include it) -- skipping.")
        return pd.DataFrame(columns=["path", "dx", "source"])

    df = pd.read_csv(BCN_METADATA_CSV)
    df["path"] = df["isic_id"].map(lambda iid: str(BCN_DIR / f"{iid}.JPG"))
    missing = ~df["path"].map(lambda p: Path(p).exists())
    if missing.sum():
        print(f"BCN20000: {missing.sum()} images referenced in metadata were not found on disk; dropping them.")
    df = df[~missing]

    df["dx"] = df["diagnosis"].map(ISIC_DIAGNOSIS_TO_HAM)
    unmapped = df[df["dx"].isna()]
    if len(unmapped):
        print(
            f"BCN20000: dropping {len(unmapped)} images whose diagnosis falls outside "
            "the 7-class taxonomy:"
        )
        print(unmapped["diagnosis"].value_counts(dropna=False))
    df = df.dropna(subset=["dx"])

    df["source"] = "bcn20000"
    return df[["path", "dx", "source"]]


def main():
    frames = [f for f in (load_ham10000(), load_bcn20000()) if len(f)]
    if not frames:
        raise FileNotFoundError(
            "No dataset found. Run download_data.py (HAM10000) and/or "
            "download_bcn20000.py (BCN20000) first."
        )
    df = pd.concat(frames, ignore_index=True)
    df["label"] = df["dx"].map(CLASS_ORDER.index)

    print("\nClass distribution by source:")
    print(df.groupby(["source", "dx"]).size().unstack(fill_value=0))
    print("\nCombined class distribution:")
    print(df["dx"].value_counts())

    train_df, val_df = train_test_split(
        df[["path", "label", "dx"]],
        test_size=0.15,
        random_state=42,
        stratify=df["dx"],
    )

    train_df[["path", "label"]].to_csv(Path(__file__).parent / "manifest_train.csv", index=False)
    val_df[["path", "label"]].to_csv(Path(__file__).parent / "manifest_val.csv", index=False)

    print(f"\nWrote {len(train_df)} training rows and {len(val_df)} validation rows.")


if __name__ == "__main__":
    main()

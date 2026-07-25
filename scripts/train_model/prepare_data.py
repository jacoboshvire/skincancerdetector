"""
Builds a train/validation manifest from the staged HAM10000 dataset, plus
whichever of BCN20000 / MSK-1..5 / UDA-1/2 / SONIC have been downloaded (see
download_bcn20000.py and download_extra_isic.py) -- combining all of them
roughly quadruples the amount of training data per class versus HAM10000
alone.

Reads ./data/HAM10000_metadata.csv and locates each image across
HAM10000_images_part_1/ and HAM10000_images_part_2/, and (if present) each
of data/bcn20000, data/isic_extra, data/isic_extra_sonic + the images
downloaded alongside their metadata.csv. All are mapped onto the same
7-class taxonomy and written out as manifest_train.csv and manifest_val.csv
with columns: path,label

Usage:
    python prepare_data.py
"""
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

DATA_DIR = Path(__file__).parent / "data"
HAM_METADATA_CSV = DATA_DIR / "HAM10000_metadata.csv"

# Must match the class order in src/lib/modelClasses.ts (HAM10000_CLASSES)
CLASS_ORDER = ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]

# Maps ISIC Archive collections' `diagnosis_3` field (the specific-diagnosis
# level of their hierarchical diagnosis_1/2/3 metadata -- NOT the flat
# `diagnosis` field some newer collections use) onto the 7-class HAM10000
# taxonomy above. Verified directly against the actual downloaded
# metadata.csv from each collection (BCN20000, MSK-1..5, UDA-1/2, SONIC),
# not just schema docs -- diagnosis_3's vocabulary isn't identical across
# collections (e.g. only MSK/UDA have any vascular-lesion cases; BCN20000
# has none).
#
# HAM10000's own class definitions already bundle several distinct
# diagnoses together: akiec covers actinic keratosis and the
# Bowen's-disease/squamous-cell-carcinoma-in-situ spectrum (extended here to
# invasive SCC too, for consistency -- HAM10000's akiec is explicitly
# described as a squamous cell carcinoma variant in the dataset's own
# documentation); bkl covers seborrheic keratosis, solar lentigo, and
# lichen-planus-like keratosis; vasc covers hemangioma, angiokeratoma, and
# pyogenic granuloma. Diagnoses with no reasonable HAM10000 equivalent
# (Scar, Verruca, Fibroepithelial polyp, indeterminate/atypical
# proliferations, etc.) are intentionally left unmapped and dropped -- see
# the "unmapped diagnoses" summary this script prints per source, which
# lists exactly what got excluded and how often.
ISIC_DIAGNOSIS_TO_HAM = {
    "Solar or actinic keratosis": "akiec",
    "Squamous cell carcinoma, NOS": "akiec",
    "Squamous cell carcinoma in situ": "akiec",
    "Squamous cell carcinoma, Invasive": "akiec",
    "Basal cell carcinoma": "bcc",
    "Seborrheic keratosis": "bkl",
    "Solar lentigo": "bkl",
    "Lichen planus like keratosis": "bkl",
    "Dermatofibroma": "df",
    "Melanoma, NOS": "mel",
    "Melanoma in situ": "mel",
    "Melanoma Invasive": "mel",
    "Melanoma metastasis": "mel",
    "Nevus": "nv",
    "Hemangioma": "vasc",
    "Angiokeratoma": "vasc",
    "Pyogenic granuloma": "vasc",
}

# (directory under ./data, source label used in the printed breakdown)
ISIC_COLLECTION_DIRS = [
    ("bcn20000", "bcn20000"),
    ("isic_extra", "isic_extra"),
    ("isic_extra_sonic", "sonic"),
]


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


def load_isic_collection(dir_name: str, source: str) -> pd.DataFrame:
    coll_dir = DATA_DIR / dir_name
    metadata_csv = coll_dir / "metadata.csv"
    if not metadata_csv.exists():
        print(
            f"{source} not found at {metadata_csv} "
            "(run download_bcn20000.py / download_extra_isic.py to include it) -- skipping."
        )
        return pd.DataFrame(columns=["path", "dx", "source"])

    df = pd.read_csv(metadata_csv)
    df["path"] = df["isic_id"].map(lambda iid: str(coll_dir / f"{iid}.JPG"))
    missing = ~df["path"].map(lambda p: Path(p).exists())
    if missing.sum():
        print(f"{source}: {missing.sum()} images referenced in metadata were not found on disk; dropping them.")
    df = df[~missing]

    df["dx"] = df["diagnosis_3"].map(ISIC_DIAGNOSIS_TO_HAM)
    unmapped = df[df["dx"].isna()]
    if len(unmapped):
        print(f"{source}: dropping {len(unmapped)} images whose diagnosis falls outside the 7-class taxonomy:")
        print(unmapped["diagnosis_3"].value_counts(dropna=False))
    df = df.dropna(subset=["dx"])

    df["source"] = source
    return df[["path", "dx", "source"]]


def main():
    loaders = [load_ham10000] + [
        (lambda d=dir_name, s=source: load_isic_collection(d, s)) for dir_name, source in ISIC_COLLECTION_DIRS
    ]
    frames = [f for f in (loader() for loader in loaders) if len(f)]
    if not frames:
        raise FileNotFoundError(
            "No dataset found. Run download_data.py (HAM10000) and/or "
            "download_bcn20000.py / download_extra_isic.py first."
        )
    df = pd.concat(frames, ignore_index=True)
    df["label"] = df["dx"].map(CLASS_ORDER.index)

    print("\nClass distribution by source:")
    print(df.groupby(["source", "dx"]).size().unstack(fill_value=0))
    print("\nCombined class distribution:")
    print(df["dx"].value_counts())
    print(f"\nTotal images: {len(df)}")

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

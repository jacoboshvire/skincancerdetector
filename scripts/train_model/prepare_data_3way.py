"""
Same combined multi-source loading logic as prepare_data.py (HAM10000 +
BCN20000 + MSK-1..5/UDA-1/2 + capped SONIC + any other isic_* collections
present), but produces a genuine three-way split instead of a plain 85:15
train/val split:

    manifest_train.csv   70% -- used for training only
    manifest_val.csv     15% -- used for training-time model selection
                                 (early stopping / epoch monitoring), exactly
                                 as before
    manifest_test.csv    15% -- NEVER touched during training or
                                 hyperparameter/epoch selection; held out
                                 purely for the final, honest per-class
                                 evaluation this dissertation reports

This directly closes the "no genuinely held-out test partition" limitation
flagged throughout Section 4.7/4.8: the current manifest_val.csv was used
both for training-time decisions AND for the reported accuracy figures,
which the dissertation already reports honestly as a weakness. Running
evaluate.py against manifest_test.csv (produced here, and never seen during
training) instead of manifest_val.csv gives a number that isn't subject to
that critique.

IMPORTANT: this OVERWRITES manifest_train.csv and manifest_val.csv in this
directory to change their proportions from 85:15 to 70:15. Back up the
current manifest_train.csv / manifest_val.csv / model_*.h5 files first if
you want to be able to reproduce the currently-reported 69.96%/65.48%
figures later -- see the run instructions.

Usage:
    python prepare_data_3way.py
"""
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

DATA_DIR = Path(__file__).parent / "data"
HAM_METADATA_CSV = DATA_DIR / "HAM10000_metadata.csv"

CLASS_ORDER = ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"]

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
    "Lymphangioma": "vasc",
    "Pigmented benign keratosis": "bkl",
    "Keratoacanthoma": "akiec",
}

ISIC_COLLECTION_DIRS = [
    ("bcn20000", "bcn20000"),
    ("isic_extra", "isic_extra"),
    ("isic_extra_sonic", "sonic"),
    ("isic_more", "isic_more"),
    ("isic_more_challenge2020", "challenge2020"),
]


def load_ham10000() -> pd.DataFrame:
    if not HAM_METADATA_CSV.exists():
        print(f"HAM10000 not found at {HAM_METADATA_CSV} -- skipping.")
        return pd.DataFrame(columns=["path", "dx", "source"])

    df = pd.read_csv(HAM_METADATA_CSV)
    image_dirs = [p for p in DATA_DIR.glob("HAM10000_images_part_*") if p.is_dir()]
    if not image_dirs:
        image_dirs = [p for p in DATA_DIR.rglob("*") if p.is_dir() and "images" in p.name.lower()]
    if not image_dirs:
        raise FileNotFoundError(f"Found {HAM_METADATA_CSV} but no HAM10000 image directories under {DATA_DIR}.")

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
        print(f"{source} not found at {metadata_csv} -- skipping.")
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
        print(f"{source}: dropping {len(unmapped)} images outside the 7-class taxonomy.")
    df = df.dropna(subset=["dx"])
    df["source"] = source
    return df[["path", "dx", "source"]]


def main():
    loaders = [load_ham10000] + [
        (lambda d=dir_name, s=source: load_isic_collection(d, s)) for dir_name, source in ISIC_COLLECTION_DIRS
    ]
    frames = [f for f in (loader() for loader in loaders) if len(f)]
    if not frames:
        raise FileNotFoundError("No dataset found under ./data.")
    df = pd.concat(frames, ignore_index=True)
    df["label"] = df["dx"].map(CLASS_ORDER.index)

    print("\nCombined class distribution:")
    print(df["dx"].value_counts())
    print(f"\nTotal images: {len(df)}")

    trainval_df, test_df = train_test_split(
        df[["path", "label", "dx"]],
        test_size=0.15,
        random_state=42,
        stratify=df["dx"],
    )
    train_df, val_df = train_test_split(
        trainval_df,
        test_size=(0.15 / 0.85),
        random_state=42,
        stratify=trainval_df["dx"],
    )

    out_dir = Path(__file__).parent
    train_df[["path", "label"]].to_csv(out_dir / "manifest_train.csv", index=False)
    val_df[["path", "label"]].to_csv(out_dir / "manifest_val.csv", index=False)
    test_df[["path", "label"]].to_csv(out_dir / "manifest_test.csv", index=False)

    print(f"\nWrote {len(train_df)} training rows (manifest_train.csv, ~70%)")
    print(f"Wrote {len(val_df)} validation rows (manifest_val.csv, ~15%)")
    print(f"Wrote {len(test_df)} TEST rows (manifest_test.csv, ~15%, held out entirely)")
    print("\nTest-set class distribution (sanity check -- should be roughly proportional):")
    print(test_df["dx"].value_counts())


if __name__ == "__main__":
    main()

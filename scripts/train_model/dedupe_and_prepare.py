"""
Drop-in replacement for prepare_data_3way.py that adds an actual,
code-enforced deduplication step before the 70:15:15 split -- closing the
gap flagged in the defence deck: "cross-collection duplicate check isn't
automated."

What it does, precisely:
  1. Loads every source exactly as prepare_data_3way.py / prepare_data.py do
     (HAM10000 + bcn20000 + isic_extra + isic_extra_sonic + isic_more +
     isic_more_challenge2020) -- same loaders, same taxonomy mapping,
     unchanged.
  2. Computes a SHA-256 content hash of every image file actually on disk.
     This catches duplicates regardless of naming scheme -- the same JPEG
     bytes staged twice under two different isic_id/image_id values (e.g. a
     HAM10000 image that also happens to be independently indexed under an
     ISIC collection) will hash identically and get caught, which an
     isic_id-only check (what download_more_isic.py did manually) cannot
     see.
  3. Where duplicate hashes are found, keeps exactly one copy per hash and
     drops the rest, preferring to keep the HAM10000 copy when one of the
     duplicates comes from HAM10000 (it's the base, most-cited dataset),
     otherwise keeping the first-encountered source in the fixed load order
     above.
  4. Writes a dedup report (dedupe_report.md) listing exactly how many
     duplicates were found, broken down by which source-pairs collided.
  5. Runs the same two-stage stratified 70:15:15 split as
     prepare_data_3way.py (same random_state=42) on the DEDUPED pool, and
     writes manifest_train.csv / manifest_val.csv / manifest_test.csv.

This does NOT re-download anything and does NOT touch your existing
model_*.h5 files. It only rewrites the three manifest CSVs, so back them up
first if you want to be able to reproduce the current test-set figures
(you should already have backup_85_15/ from RETRAIN_STEPS.md -- also copy
the current manifest_train.csv / manifest_val.csv / manifest_test.csv
somewhere before running this, e.g.:

    mkdir -p backup_pre_dedupe
    cp manifest_train.csv manifest_val.csv manifest_test.csv backup_pre_dedupe/

Usage:
    python dedupe_and_prepare.py
"""
import hashlib
from pathlib import Path

import pandas as pd
from sklearn.model_selection import train_test_split

# ---------------------------------------------------------------------------
# Same loading logic as prepare_data.py / prepare_data_3way.py, unchanged.
# ---------------------------------------------------------------------------
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

# Fixed load order -- also the tie-break preference order when two sources
# turn out to contain the identical image (earlier in this list wins).
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


# ---------------------------------------------------------------------------
# New: content-hash dedup
# ---------------------------------------------------------------------------
def sha256_of_file(path: str, chunk_size: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(chunk_size), b""):
            h.update(chunk)
    return h.hexdigest()


def dedupe(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Returns (deduped_df, duplicates_dropped_df)."""
    print(f"\nHashing {len(df)} images to check for cross-collection duplicates "
          f"(this reads every file once -- expect it to take a while for ~95k images)...")

    hashes = []
    n = len(df)
    for i, p in enumerate(df["path"].tolist()):
        hashes.append(sha256_of_file(p))
        if (i + 1) % 5000 == 0 or (i + 1) == n:
            print(f"  hashed {i + 1}/{n}")
    df = df.copy()
    df["_hash"] = hashes

    # Preserve the fixed source preference order for tie-breaking.
    source_priority = {"ham10000": 0}
    for i, (_, s) in enumerate(ISIC_COLLECTION_DIRS, start=1):
        source_priority[s] = i
    df["_priority"] = df["source"].map(source_priority).fillna(99)

    df_sorted = df.sort_values("_priority", kind="stable")
    is_dup = df_sorted.duplicated(subset="_hash", keep="first")
    duplicates = df_sorted[is_dup].copy()
    deduped = df_sorted[~is_dup].drop(columns=["_hash", "_priority"])

    return deduped.reset_index(drop=True), duplicates.reset_index(drop=True)


def write_dedupe_report(duplicates: pd.DataFrame, out_path: Path) -> None:
    lines = ["# Dataset deduplication report", ""]
    if duplicates.empty:
        lines.append("No exact-content duplicate images were found across any of the loaded sources.")
    else:
        lines.append(f"**{len(duplicates)} duplicate images found and removed** "
                      f"(kept one copy of each, preferring HAM10000, then the fixed collection load order).")
        lines.append("")
        lines.append("By class:")
        lines.append("")
        lines.append(duplicates["dx"].value_counts().to_string())
        lines.append("")
        lines.append("By the source the *dropped* copy came from:")
        lines.append("")
        lines.append(duplicates["source"].value_counts().to_string())
    out_path.write_text("\n".join(lines) + "\n")
    print(f"\nWrote {out_path}")


def main():
    loaders = [load_ham10000] + [
        (lambda d=dir_name, s=source: load_isic_collection(d, s)) for dir_name, source in ISIC_COLLECTION_DIRS
    ]
    frames = [f for f in (loader() for loader in loaders) if len(f)]
    if not frames:
        raise FileNotFoundError("No dataset found under ./data.")
    df = pd.concat(frames, ignore_index=True)

    print("\nCombined class distribution BEFORE dedup:")
    print(df["dx"].value_counts())
    print(f"Total images before dedup: {len(df)}")

    deduped, duplicates = dedupe(df)

    print("\nCombined class distribution AFTER dedup:")
    print(deduped["dx"].value_counts())
    print(f"Total images after dedup: {len(deduped)} ({len(duplicates)} duplicates removed)")

    write_dedupe_report(duplicates, Path(__file__).parent / "dedupe_report.md")

    deduped["label"] = deduped["dx"].map(CLASS_ORDER.index)

    # Same two-stage stratified split as prepare_data_3way.py.
    trainval_df, test_df = train_test_split(
        deduped[["path", "label", "dx"]],
        test_size=0.15,
        random_state=42,
        stratify=deduped["dx"],
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

    print(f"\nWrote {len(train_df)} training rows (manifest_train.csv, ~70% of deduped pool)")
    print(f"Wrote {len(val_df)} validation rows (manifest_val.csv, ~15%)")
    print(f"Wrote {len(test_df)} TEST rows (manifest_test.csv, ~15%, held out entirely)")


if __name__ == "__main__":
    main()

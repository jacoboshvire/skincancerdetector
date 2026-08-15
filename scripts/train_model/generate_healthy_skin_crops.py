"""
Generates "healthy skin" training images for the gate model (see train_gate.py)
by cropping the corners of wide, non-dermoscopic clinical photos we already
have -- no public "healthy skin" / "normal skin" dataset exists (dermatology
archives are lesion-focused by design), so this is a heuristic, not
expert-verified ground truth: the corners of a clinical close-up or overview
photo are very likely to show normal skin away from whatever lesion the
photo was actually taken for, but there's no guarantee for any single crop.

Only pulls from image_type "clinical: close-up" / "clinical: overview" rows
(regular camera photos, not through a dermatoscope) across whichever of
data/{bcn20000,isic_extra,isic_extra_sonic,isic_more,isic_more_challenge2020,
skin_tone_diverse} have an image_type column with those values -- e.g.
PAD-UFES-20, MILK10k, MILK10k Benchmark, HIBA. Dermoscopic images are
skipped since they're a tight, fully-zoomed view through a dermatoscope
lens with little to no "just skin" margin.

data/skin_tone_diverse (see download_skin_tone_diverse.py) exists because
the clinical-photo pool otherwise skews heavily toward lighter Fitzpatrick
skin types (checked directly: of the ~8,400 clinical images available before
adding this source, only 84 had a Fitzpatrick IV-VI label vs. 1,795 labeled
I-III, and 78% had no label at all) -- a well-documented bias in public
dermatology datasets generally. The MSKCC Skin Tone Labeling Dataset (ISIC
collection 413) was built specifically to have balanced representation
across all 6 Fitzpatrick types, so its clinical close-ups are included here
in full to correct that skew rather than compound it.

Usage:
    python generate_healthy_skin_crops.py
"""
from pathlib import Path

import pandas as pd
from PIL import Image

DATA_DIR = Path(__file__).parent / "data"
OUT_DIR = DATA_DIR / "healthy_skin_crops"
CLINICAL_TYPES = {"clinical: close-up", "clinical: overview"}

# Fraction of width/height each corner crop takes, and how far from the true
# corner (0,0) it's inset -- a small inset avoids photo borders/vignetting.
CROP_FRACTION = 0.28
INSET_FRACTION = 0.04

SOURCE_DIRS = [
    "bcn20000", "isic_extra", "isic_extra_sonic", "isic_more", "isic_more_challenge2020",
    "skin_tone_diverse",
]


def crop_corners(image_path: Path, out_stem: str) -> int:
    try:
        img = Image.open(image_path).convert("RGB")
    except Exception as e:
        print(f"  skipping {image_path.name}: {e}")
        return 0

    w, h = img.size
    cw, ch = int(w * CROP_FRACTION), int(h * CROP_FRACTION)
    ix, iy = int(w * INSET_FRACTION), int(h * INSET_FRACTION)
    corners = {
        "tl": (ix, iy, ix + cw, iy + ch),
        "tr": (w - ix - cw, iy, w - ix, iy + ch),
        "bl": (ix, h - iy - ch, ix + cw, h - iy),
        "br": (w - ix - cw, h - iy - ch, w - ix, h - iy),
    }

    n = 0
    for name, box in corners.items():
        crop = img.crop(box)
        crop.save(OUT_DIR / f"{out_stem}_{name}.jpg", quality=90)
        n += 1
    return n


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    total = 0
    for dir_name in SOURCE_DIRS:
        metadata_csv = DATA_DIR / dir_name / "metadata.csv"
        if not metadata_csv.exists():
            print(f"{dir_name}: no metadata.csv, skipping")
            continue

        df = pd.read_csv(metadata_csv, low_memory=False)
        if "image_type" not in df.columns:
            print(f"{dir_name}: no image_type column, skipping")
            continue

        clinical = df[df["image_type"].isin(CLINICAL_TYPES)]
        print(f"{dir_name}: {len(clinical)} clinical (non-dermoscopic) images")

        made = 0
        for isic_id in clinical["isic_id"]:
            image_path = DATA_DIR / dir_name / f"{isic_id}.JPG"
            if not image_path.exists():
                continue
            made += crop_corners(image_path, f"{dir_name}_{isic_id}")
        print(f"  -> generated {made} corner crops")
        total += made

    print(f"\nTotal healthy-skin crops generated: {total} in {OUT_DIR}")


if __name__ == "__main__":
    main()

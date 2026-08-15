"""
Downloads UTKFace (aligned/cropped face photos, ~23.7k images, non-commercial
research use) via kagglehub and copies a race-balanced sample directly into
data/healthy_skin_crops/ as additional "healthy skin" training images for
the gate model.

Why this exists: every existing healthy_skin example (see
generate_healthy_skin_crops.py) is a corner crop of a *clinical dermatology
photo* -- tightly zoomed on a patch of skin, no face, hair, clothing, or
background in frame. Real users mostly upload normal phone photos (selfies,
photos of an arm or face at ordinary camera distance), which look nothing
like that. A live test caught this directly: a real selfie was classified
"not skin" at 88% confidence, because the model had only ever seen "skin"
as tightly-cropped clinical texture, not as a normal photo composition.
UTKFace's face crops -- while still fairly tight, not full selfie framing --
are at least genuine non-clinical photos of real skin, giving the model a
second, very different distribution of "this is skin" examples to learn
from instead of one narrow one.

UTKFace filenames encode [age]_[gender]_[race]_[timestamp].jpg.chip.jpg,
race: 0=White, 1=Black, 2=Asian, 3=Indian, 4=Other. Raw distribution is
skewed (10,078 White vs. 1,692 Other) -- capped per group here so the
sample doesn't just reproduce that skew, continuing the same balancing
approach as download_skin_tone_diverse.py.

Usage:
    python download_face_diversity.py
"""
import shutil
from pathlib import Path

import kagglehub

PER_RACE_CAP = 3000
OUT_DIR = Path(__file__).parent / "data" / "healthy_skin_crops"
RACE_NAMES = {0: "white", 1: "black", 2: "asian", 3: "indian", 4: "other"}


def main():
    print("Downloading UTKFace via kagglehub...")
    cache_path = Path(kagglehub.dataset_download("moritzm00/utkface-cropped"))
    src_dir = cache_path / "UTKFace"
    if not src_dir.exists():
        # some mirrors nest differently
        candidates = list(cache_path.rglob("*.jpg.chip.jpg"))
        if not candidates:
            raise FileNotFoundError(f"Could not find UTKFace images under {cache_path}")
        src_dir = candidates[0].parent

    by_race: dict[int, list[Path]] = {r: [] for r in RACE_NAMES}
    skipped = 0
    for f in src_dir.glob("*.jpg.chip.jpg"):
        parts = f.stem.split("_")
        if len(parts) < 3:
            skipped += 1
            continue
        try:
            race = int(parts[2])
        except ValueError:
            skipped += 1
            continue
        if race in by_race:
            by_race[race].append(f)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    total = 0
    for race, files in sorted(by_race.items()):
        files.sort()  # deterministic
        sample = files[:PER_RACE_CAP]
        for f in sample:
            dest = OUT_DIR / f"utkface_{RACE_NAMES[race]}_{f.name}"
            if not dest.exists():
                shutil.copy2(f, dest)
        print(f"{RACE_NAMES[race]}: {len(sample)} of {len(files)} available")
        total += len(sample)

    print(f"\nCopied {total} race-balanced UTKFace images into {OUT_DIR} ({skipped} unparseable filenames skipped)")


if __name__ == "__main__":
    main()

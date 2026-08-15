"""
Downloads the clinical (non-dermoscopic) close-up images from the MSKCC Skin
Tone Labeling Dataset (ISIC Archive collection 413) to stage under
./data/skin_tone_diverse.

This exists to fix a real, measured skew: of the ~8,400 clinical photos
generate_healthy_skin_crops.py had to draw "healthy skin" corner crops from
before this source was added, only 84 carried a Fitzpatrick IV-VI (darker
skin) label versus 1,795 labeled I-III (lighter skin), and 78% had no
Fitzpatrick label at all -- the well-documented "public dermatology datasets
skew light-skinned" problem, not a hypothetical concern. The MSKCC Skin Tone
Labeling Dataset was built specifically for balanced Fitzpatrick
representation (verified directly against its metadata: roughly 180-240
images per Fitzpatrick type, all 6 types, in the clinical close-up subset
pulled here), and every image in it is confirmed disjoint from everything
else this project has downloaded.

Every image here has a "Benign" diagnosis_1 (a real, benign lesion -- e.g. a
common mole), not confirmed lesion-free skin; it's used the same way as
every other clinical-photo source in this project, via corner-cropping away
from the photo's center, not as direct positive examples.

Requires isic-cli (see download_bcn20000.py for install notes).

Usage:
    python download_skin_tone_diverse.py
"""
import shutil
import subprocess
from pathlib import Path

COLLECTION_ID = "413"  # MSKCC Skin Tone Labeling Dataset
DEST = Path(__file__).parent / "data" / "skin_tone_diverse"


def main():
    if shutil.which("isic") is None:
        raise SystemExit(
            "isic-cli not found on PATH. Install it first: pip install isic-cli\n"
            "(or grab the standalone binary: "
            "https://github.com/ImageMarkup/isic-cli/releases/latest)"
        )

    print(f"Downloading clinical close-ups from collection {COLLECTION_ID} to {DEST}...")
    subprocess.run(
        [
            "isic", "image", "download",
            "--collections", COLLECTION_ID,
            "--search", 'image_type:"clinical: close-up"',
            str(DEST),
        ],
        check=True,
    )
    print(f"Staged at: {DEST}")


if __name__ == "__main__":
    main()

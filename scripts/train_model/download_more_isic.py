"""
Downloads a further batch of ISIC Archive collections beyond BCN20000 and
the MSK/UDA/SONIC set (see download_bcn20000.py and download_extra_isic.py):
PAD-UFES-20, DERM12345, HIBA, ISIC-DICM-17K, MILK10k (+ Benchmark),
Melanoma and Nevus, and several smaller labeled collections, plus a
filtered (diagnosis-labeled only) slice of the 2020 Challenge training set.
Stages them under ./data/isic_more and ./data/isic_more_challenge2020.

Every collection ID here was checked before being included: each one's
isic_id set was verified against every image already downloaded in this
project (HAM10000 + BCN20000 + MSK/UDA/SONIC) to confirm no duplicate
images, and its diagnosis_3 field was checked for real, non-null labels.
Two collections were dropped as a result:
  - iToBoS 2024 (collection 459, 16,954 images): has no diagnosis field at
    all -- unlabeled tile data, unusable for classification.
  - Challenge 2020 Training (collection 70, 33,126 images): 82% of it has
    no diagnosis_3 label either (only benign/malignant, not the 7-class
    taxonomy), so only the labeled ~6,015-image subset is pulled here via
    a search filter, not the full collection.
Also, three collections turned out to be exact duplicates of others under
a different name/curation (176 and 251 duplicate 175 "HIBA"; 163 duplicates
216 "Consecutive biopsies for melanoma across year 2020") and are excluded.

Requires isic-cli (see download_bcn20000.py for install notes).

Usage:
    python download_more_isic.py
"""
import shutil
import subprocess
from pathlib import Path

# PAD-UFES-20, DERM12345, HIBA, ISIC-DICM-17K, MILK10k, MILK10k Benchmark,
# Melanoma and Nevus, Consecutive biopsies 2020, Newly-acquired, Repeated
# Dermoscopic, BRAAFF Acral, Longitudinal overview, 15 Exemplar
# Infundibulocystic BCC, EASY Dermoscopy, Melanocytic lesions used,
# Longitudinal Images, PROVe-AI, Consumer AI apps.
LABELED_COLLECTIONS = [
    "406", "399", "175", "469", "425", "424", "294", "216", "215", "328",
    "410", "217", "471", "166", "77", "383", "218", "75",
]
CHALLENGE_2020_COLLECTION = "70"
CHALLENGE_2020_SEARCH = 'diagnosis_3:*'

DEST_MORE = Path(__file__).parent / "data" / "isic_more"
DEST_CHALLENGE2020 = Path(__file__).parent / "data" / "isic_more_challenge2020"


def main():
    if shutil.which("isic") is None:
        raise SystemExit(
            "isic-cli not found on PATH. Install it first: pip install isic-cli\n"
            "(or grab the standalone binary: "
            "https://github.com/ImageMarkup/isic-cli/releases/latest)"
        )

    print(f"Downloading {len(LABELED_COLLECTIONS)} collections to {DEST_MORE}...")
    subprocess.run(
        ["isic", "image", "download", "--collections", ",".join(LABELED_COLLECTIONS), str(DEST_MORE)],
        check=True,
    )

    print(f"Downloading labeled subset of Challenge 2020 Training to {DEST_CHALLENGE2020}...")
    subprocess.run(
        [
            "isic", "image", "download",
            "--collections", CHALLENGE_2020_COLLECTION,
            "--search", CHALLENGE_2020_SEARCH,
            str(DEST_CHALLENGE2020),
        ],
        check=True,
    )

    print(f"Staged at: {DEST_MORE} and {DEST_CHALLENGE2020}")


if __name__ == "__main__":
    main()

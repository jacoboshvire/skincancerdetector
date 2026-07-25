"""
Downloads the BCN20000 skin lesion dataset (ISIC Archive collection 249) via
isic-cli and stages it under ./data/bcn20000.

BCN20000 (Hospital Clinic de Barcelona, 2010-2016) is used here as a
complement to HAM10000 rather than a replacement: ~18,900 dermoscopic images
across the same core diagnostic categories, roughly double HAM10000's 10,015.
It's a good pairing specifically because it's disjoint from HAM10000 (unlike,
say, the ISIC 2019 archive, whose training set is itself a superset that
already contains HAM10000 -- combining that with HAM10000 directly would
duplicate images rather than add new ones).

Requires isic-cli:
    pip install isic-cli
If the pip-installed `isic` refuses to run with a "new major version
available" message, the pip package trails the standalone releases -- grab
the binary instead:
    https://github.com/ImageMarkup/isic-cli/releases/latest

Usage:
    python download_bcn20000.py
"""
import shutil
import subprocess
from pathlib import Path

COLLECTION_ID = "249"  # BCN20000, see https://api.isic-archive.com/collections/249/
DEST = Path(__file__).parent / "data" / "bcn20000"


def main():
    if shutil.which("isic") is None:
        raise SystemExit(
            "isic-cli not found on PATH. Install it first: pip install isic-cli\n"
            "(or grab the standalone binary: "
            "https://github.com/ImageMarkup/isic-cli/releases/latest)"
        )

    print(f"Downloading BCN20000 (collection {COLLECTION_ID}) via isic-cli to {DEST}...")
    print("~18,900 images up to 1024x1024 -- this can take a while and several GB of disk.")
    subprocess.run(
        ["isic", "image", "download", "--collections", COLLECTION_ID, str(DEST)],
        check=True,
    )

    print(f"Dataset staged at: {DEST}")
    print("Expected contents: metadata.csv, <isic_id>.JPG per image")


if __name__ == "__main__":
    main()

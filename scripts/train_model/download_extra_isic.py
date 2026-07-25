"""
Downloads additional ISIC Archive collections beyond BCN20000 (see
download_bcn20000.py) to further grow the combined training set: MSK-1..5,
UDA-1, UDA-2, and a capped sample of SONIC. Stages them under
./data/isic_extra and ./data/isic_extra_sonic.

MSK-1..5 (Memorial Sloan Kettering) and UDA-1/2 (University of Athens) are
genuinely distinct source institutions from HAM10000/BCN20000, with real
diagnostic diversity -- melanoma, basal cell carcinoma, actinic keratosis,
and (unlike BCN20000, which has none) some vascular lesions.

SONIC is different: it's 100% nevus (9,251 of 9,251 images, verified against
its actual downloaded metadata). Since nevus is already this dataset's
dominant class, pulling in all of it would skew the combined set further
without adding diagnostic diversity, so it's capped at SONIC_LIMIT and
downloaded to its own directory purely to help reach a target dataset size.

Requires isic-cli (see download_bcn20000.py for install notes).

Usage:
    python download_extra_isic.py
"""
import shutil
import subprocess
from pathlib import Path

# MSK-1, MSK-2, MSK-3, MSK-4, MSK-5, UDA-1, UDA-2 -- see
# https://api.isic-archive.com/collections/<id>/ for each.
DIVERSE_COLLECTIONS = ["289", "290", "288", "287", "286", "292", "291"]
SONIC_COLLECTION = "293"
SONIC_LIMIT = 3900

DEST_DIVERSE = Path(__file__).parent / "data" / "isic_extra"
DEST_SONIC = Path(__file__).parent / "data" / "isic_extra_sonic"


def main():
    if shutil.which("isic") is None:
        raise SystemExit(
            "isic-cli not found on PATH. Install it first: pip install isic-cli\n"
            "(or grab the standalone binary: "
            "https://github.com/ImageMarkup/isic-cli/releases/latest)"
        )

    print(f"Downloading MSK-1..5 + UDA-1/2 (collections {','.join(DIVERSE_COLLECTIONS)}) to {DEST_DIVERSE}...")
    subprocess.run(
        ["isic", "image", "download", "--collections", ",".join(DIVERSE_COLLECTIONS), str(DEST_DIVERSE)],
        check=True,
    )

    print(f"Downloading {SONIC_LIMIT} of SONIC's images (collection {SONIC_COLLECTION}) to {DEST_SONIC}...")
    subprocess.run(
        [
            "isic", "image", "download",
            "--collections", SONIC_COLLECTION,
            "--limit", str(SONIC_LIMIT),
            str(DEST_SONIC),
        ],
        check=True,
    )

    print(f"Staged at: {DEST_DIVERSE} and {DEST_SONIC}")


if __name__ == "__main__":
    main()

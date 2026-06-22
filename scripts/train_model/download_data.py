"""
Downloads the HAM10000 ("Human Against Machine with 10000 training images")
skin lesion dataset via kagglehub and stages it under ./data.

Requires a Kaggle account. Either:
  - run `kaggle` CLI login once (creates ~/.kaggle/kaggle.json), or
  - set KAGGLE_USERNAME / KAGGLE_KEY environment variables.

Usage:
    python download_data.py
"""
import shutil
from pathlib import Path

import kagglehub

DATASET = "kmader/skin-cancer-mnist-ham10000"
DEST = Path(__file__).parent / "data"


def main():
    print(f"Downloading {DATASET} via kagglehub...")
    cache_path = Path(kagglehub.dataset_download(DATASET))
    print(f"Downloaded to cache: {cache_path}")

    DEST.mkdir(parents=True, exist_ok=True)
    for item in cache_path.iterdir():
        target = DEST / item.name
        if target.exists():
            continue
        if item.is_dir():
            shutil.copytree(item, target)
        else:
            shutil.copy2(item, target)

    print(f"Dataset staged at: {DEST}")
    print("Expected contents: HAM10000_metadata.csv, HAM10000_images_part_1/, HAM10000_images_part_2/")


if __name__ == "__main__":
    main()

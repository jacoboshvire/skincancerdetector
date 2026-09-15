"""
One-off diagnostic + dedup runner. Reuses dedupe_and_prepare.py's loaders,
dedupe(), and write_dedupe_report() exactly as provided (imported, not
copied), so the final manifests/dedupe_report.md this produces are identical
to what running `python dedupe_and_prepare.py` directly would produce.

The only addition: before dropping the per-row hash, cross-reference every
duplicate pair against the OLD (pre-dedup) manifest_train/val/test.csv split
assignments in backup_pre_dedupe/, to answer directly: did any duplicate
pair have its two copies land in *different* old splits (e.g. one in
manifest_train.csv, its identical twin in manifest_test.csv)? That's actual
train/test leakage in the already-reported dissertation figures, not just a
duplicate-exists count. Doing this in the same hashing pass avoids re-reading
~95k image files a second time.
"""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
import dedupe_and_prepare as dp  # noqa: E402

HERE = Path(__file__).parent
OLD_SPLIT_DIR = HERE / "backup_pre_dedupe"


def load_old_split_map() -> dict:
    mapping = {}
    for split_name, fname in [("train", "manifest_train.csv"), ("val", "manifest_val.csv"), ("test", "manifest_test.csv")]:
        df = pd.read_csv(OLD_SPLIT_DIR / fname)
        for p in df["path"]:
            mapping[p] = split_name
    return mapping


def main():
    old_split = load_old_split_map()
    print(f"Loaded old split assignment for {len(old_split)} images from {OLD_SPLIT_DIR}")

    loaders = [dp.load_ham10000] + [
        (lambda d=dir_name, s=source: dp.load_isic_collection(d, s)) for dir_name, source in dp.ISIC_COLLECTION_DIRS
    ]
    frames = [f for f in (loader() for loader in loaders) if len(f)]
    df = pd.concat(frames, ignore_index=True)

    print("\nCombined class distribution BEFORE dedup:")
    print(df["dx"].value_counts())
    print(f"Total images before dedup: {len(df)}")

    # Hash once, keep the hash column around for the leakage cross-check
    # (dp.dedupe() would normally drop it from the kept/deduped frame).
    print(f"\nHashing {len(df)} images (single pass, ~26GB total)...")
    hashes = []
    n = len(df)
    for i, p in enumerate(df["path"].tolist()):
        hashes.append(dp.sha256_of_file(p))
        if (i + 1) % 5000 == 0 or (i + 1) == n:
            print(f"  hashed {i + 1}/{n}")
    df = df.copy()
    df["_hash"] = hashes
    df["_old_split"] = df["path"].map(old_split).fillna("unknown")

    source_priority = {"ham10000": 0}
    for i, (_, s) in enumerate(dp.ISIC_COLLECTION_DIRS, start=1):
        source_priority[s] = i
    df["_priority"] = df["source"].map(source_priority).fillna(99)

    df_sorted = df.sort_values("_priority", kind="stable")
    is_dup = df_sorted.duplicated(subset="_hash", keep="first")
    duplicates = df_sorted[is_dup].copy()
    deduped_full = df_sorted[~is_dup].copy()  # keep extra columns for leakage check
    deduped = deduped_full.drop(columns=["_hash", "_priority", "_old_split"]).reset_index(drop=True)
    duplicates = duplicates.reset_index(drop=True)

    print("\nCombined class distribution AFTER dedup:")
    print(deduped["dx"].value_counts())
    print(f"Total images after dedup: {len(deduped)} ({len(duplicates)} duplicates removed)")

    dp.write_dedupe_report(duplicates, HERE / "dedupe_report.md")

    # --- Leakage cross-check against the OLD (pre-dedup) split ---
    kept_by_hash = deduped_full.set_index("_hash")[["path", "_old_split"]]
    cross_split_pairs = []
    within_split_pairs = []
    for _, dup_row in duplicates.iterrows():
        h = dup_row["_hash"]
        if h not in kept_by_hash.index:
            continue
        kept_row = kept_by_hash.loc[h]
        if isinstance(kept_row, pd.DataFrame):  # >2 total copies of the same hash
            kept_row = kept_row.iloc[0]
        pair = {
            "dropped_path": dup_row["path"],
            "dropped_old_split": dup_row["_old_split"],
            "kept_path": kept_row["path"],
            "kept_old_split": kept_row["_old_split"],
        }
        if dup_row["_old_split"] != kept_row["_old_split"]:
            cross_split_pairs.append(pair)
        else:
            within_split_pairs.append(pair)

    leakage_lines = ["# Train/test leakage cross-check (pre-dedup split)", ""]
    leakage_lines.append(
        f"Of {len(duplicates)} duplicate images found, {len(cross_split_pairs)} had their kept/dropped "
        f"copy assigned to **different** splits in the previously-reported 70:15:15 manifests "
        f"(backup_pre_dedupe/), and {len(within_split_pairs)} had both copies in the same old split "
        f"(duplicate existed, but caused no cross-split leakage)."
    )
    leakage_lines.append("")
    if cross_split_pairs:
        leakage_lines.append("## Cross-split duplicate pairs (actual leakage in the reported figures)")
        leakage_lines.append("")
        leakage_lines.append("| kept split | dropped split | kept path | dropped path |")
        leakage_lines.append("|---|---|---|---|")
        for p in cross_split_pairs:
            leakage_lines.append(
                f"| {p['kept_old_split']} | {p['dropped_old_split']} | `{p['kept_path']}` | `{p['dropped_path']}` |"
            )
        leakage_lines.append("")
        test_involved = sum(1 for p in cross_split_pairs if "test" in (p["kept_old_split"], p["dropped_old_split"]))
        leakage_lines.append(f"Of these, {test_involved} directly involve `manifest_test.csv` "
                              f"(the held-out set the reported 63.64%/68.67% figures came from).")
    else:
        leakage_lines.append("No cross-split duplicate pairs found. The previously-reported held-out test "
                              "figures were not affected by cross-collection duplication.")
    (HERE / "leakage_check_report.md").write_text("\n".join(leakage_lines) + "\n")
    print(f"\nWrote {HERE / 'leakage_check_report.md'}")
    print(f"Cross-split duplicate pairs: {len(cross_split_pairs)} / {len(duplicates)} total duplicates")

    # --- Same re-split as dedupe_and_prepare.py ---
    deduped["label"] = deduped["dx"].map(dp.CLASS_ORDER.index)
    from sklearn.model_selection import train_test_split

    trainval_df, test_df = train_test_split(
        deduped[["path", "label", "dx"]], test_size=0.15, random_state=42, stratify=deduped["dx"],
    )
    train_df, val_df = train_test_split(
        trainval_df, test_size=(0.15 / 0.85), random_state=42, stratify=trainval_df["dx"],
    )

    train_df[["path", "label"]].to_csv(HERE / "manifest_train.csv", index=False)
    val_df[["path", "label"]].to_csv(HERE / "manifest_val.csv", index=False)
    test_df[["path", "label"]].to_csv(HERE / "manifest_test.csv", index=False)

    print(f"\nWrote {len(train_df)} training rows (manifest_train.csv, ~70% of deduped pool)")
    print(f"Wrote {len(val_df)} validation rows (manifest_val.csv, ~15%)")
    print(f"Wrote {len(test_df)} TEST rows (manifest_test.csv, ~15%, held out entirely)")


if __name__ == "__main__":
    main()

# Patch: add a --manifest flag to evaluate.py

Your current `evaluate.py` hardcodes `manifest_val.csv`. Add this small change
so you can point it at `manifest_test.csv` once that exists, without losing
the ability to re-check against `manifest_val.csv` too.

1. Add `import argparse` near the top (with the other imports).

2. Replace `load_manifest()` with:

```python
def load_manifest(filename: str) -> pd.DataFrame:
    df = pd.read_csv(HERE / filename)
    exists = df["path"].apply(lambda p: Path(p).exists())
    missing = int((~exists).sum())
    if missing:
        print(
            f"[warn] {missing} of {len(df)} validation images referenced in "
            f"{filename} are missing on disk; skipping them."
        )
        df = df[exists].reset_index(drop=True)
    if df.empty:
        raise RuntimeError(f"No validation images found on disk in {filename} -- nothing to evaluate.")
    return df
```

3. Replace `main()` with:

```python
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--manifest", default="manifest_val.csv",
        help="Which manifest CSV to evaluate against (default: manifest_val.csv). "
             "Pass manifest_test.csv once prepare_data_3way.py has produced it, "
             "for the genuinely held-out figure.",
    )
    args = parser.parse_args()

    df = load_manifest(args.manifest)
    print(f"Evaluating against {args.manifest}: {len(df)} images")
    results = [evaluate_arch(arch, df) for arch in ARCHS]
    write_summary(results)


if __name__ == "__main__":
    main()
```

That's it -- everything else (plot_confusion_matrix, evaluate_arch, write_summary)
stays exactly as you have it.

Run it two ways once you've retrained:

```bash
python evaluate.py --manifest manifest_val.csv    # training-time-style figure, for comparison
python evaluate.py --manifest manifest_test.csv   # the genuinely held-out figure to report
```

Note this will overwrite `evaluation_summary.md` and the two PNGs each time --
rename them after each run (e.g. `evaluation_summary_test.md`) if you want to
keep both.

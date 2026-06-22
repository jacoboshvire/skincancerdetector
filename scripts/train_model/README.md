# Training pipeline: HAM10000 → TensorFlow.js

Produces the model the web app loads at `public/model/model.json`. This is a
one-time (or occasional) offline step run with Python — it is separate from
the Next.js app, which only ever runs inference, never training.

## What it does

Transfer-learns MobileNetV2 (ImageNet weights) on
[HAM10000](https://www.kaggle.com/datasets/kmader/skin-cancer-mnist-ham10000),
10,015 dermoscopic images across 7 lesion categories. The base is frozen
while a new classification head trains, then the top of MobileNetV2 is
unfrozen for a short fine-tuning pass.

## Setup

```bash
cd scripts/train_model
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Steps

1. **Download the dataset** (requires a free Kaggle account):

   ```bash
   # one-time: either run `kaggle` CLI login, or export these:
   export KAGGLE_USERNAME=your_username
   export KAGGLE_KEY=your_key

   python download_data.py
   ```

   This stages the dataset under `scripts/train_model/data/`.

2. **Build train/validation manifests:**

   ```bash
   python prepare_data.py
   ```

3. **Train:**

   ```bash
   python train.py
   ```

   Outputs `model.h5` in this directory. On CPU on a MacBook Air (8GB), the
   full run (5 head epochs + 10 fine-tune epochs) takes roughly 30-40
   minutes. Expect val accuracy around 70-73% on the 7-class problem —
   HAM10000 is heavily skewed toward benign nevi (`nv`), which `train.py`
   corrects for with class weighting, but this is a teaching example, not a
   clinical-grade classifier.

   Two environment variables matter here:
   - `FORCE_CPU=1` — on Apple Silicon, `tensorflow-metal` GPU acceleration is
     fast for the training steps themselves but has been observed to hang
     indefinitely during the validation phase (TF 2.16 / tensorflow-metal
     1.2.0). If training stalls after the first epoch's steps complete with
     no progress for several minutes, kill it and rerun with `FORCE_CPU=1`.
   - `TF_USE_LEGACY_KERAS=1` — set unconditionally inside `train.py` itself
     (you don't need to pass it). TF 2.16 defaults to Keras 3, which
     serializes models (`InputLayer` config, functional-graph node format)
     in a way the browser-side `tfjs` runtime cannot parse — it fails with
     errors like `"An InputLayer should be passed either a batchInputShape
     or an inputShape"` or `"Corrupted configuration, expected array for
     nodeData"`. Training under legacy Keras 2 (the `tf_keras` package,
     installed as a `tensorflowjs` dependency) avoids this rather than
     patching the JSON after the fact. `convert_to_tfjs.py` sets the same
     flag, since the model must be loaded the same way it was saved.

4. **Convert to TensorFlow.js:**

   ```bash
   python convert_to_tfjs.py
   ```

   Writes `model.json` and weight shard `.bin` files into `public/model/`.
   Restart (or just refresh) the Next.js dev server — the dashboard will pick
   the model up automatically.

## Keeping preprocessing in sync

The client (`src/lib/clientModel.ts`) resizes images to 224×224 and scales
pixels to `[-1, 1]` (`pixel / 127.5 - 1`). `train.py` applies the identical
transform when building its `tf.data.Dataset`. If you change one, change the
other — a mismatch here silently produces garbage predictions rather than an
error.

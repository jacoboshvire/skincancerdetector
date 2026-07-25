# Training pipeline: HAM10000 → TensorFlow.js

Produces the models the web app loads from `public/model/<arch>/model.json`.
This is a one-time (or occasional) offline step run with Python; it is
separate from the Next.js app, which only ever runs inference, never
training.

## What it does

Transfer-learns an ImageNet-pretrained backbone on
[HAM10000](https://www.kaggle.com/datasets/kmader/skin-cancer-mnist-ham10000)
(10,015 dermoscopic images), optionally combined with
[BCN20000](https://api.isic-archive.com/collections/249/) (~18,900 more,
disjoint from HAM10000) for roughly 3x the training data across the same 7
lesion categories. The base is frozen while a new classification head
trains, then the top of the backbone is unfrozen for a short fine-tuning
pass.

Two architectures are supported out of the box, selected via the
`MODEL_ARCH` environment variable (default `mobilenetv2`):

| `MODEL_ARCH`     | Backbone       | Notes                                              |
|------------------|----------------|-----------------------------------------------------|
| `mobilenetv2`    | MobileNetV2    | Smallest download, fastest in-browser inference.    |
| `efficientnetb0` | EfficientNetB0 | Larger, typically higher accuracy.                  |

Adding another architecture means adding an entry to `MODEL_ARCHS` in
`train.py` (the Keras application class, whether it needs `[-1, 1]`
rescaling, and the fine-tune-frozen fraction) and a matching entry in
`src/lib/modelRegistry.ts` on the frontend.

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

   **Optional: also add BCN20000** for more training data (no image overlap
   with HAM10000, same diagnostic categories):

   ```bash
   pip install isic-cli   # or grab the standalone binary if pip's copy
                           # refuses to run with a "new major version" error:
                           # https://github.com/ImageMarkup/isic-cli/releases/latest

   python download_bcn20000.py
   ```

   This stages ~18,900 images (up to 1024x1024, several GB) under
   `scripts/train_model/data/bcn20000/`. `prepare_data.py` picks it up
   automatically if present, maps its `diagnosis` field onto the same 7
   classes, and drops anything outside that taxonomy (see
   `ISIC_DIAGNOSIS_TO_HAM` in `prepare_data.py` for exactly what's dropped).

2. **Build train/validation manifests:**

   ```bash
   python prepare_data.py
   ```

3. **Train:**

   ```bash
   MODEL_ARCH=mobilenetv2 python train.py        # or efficientnetb0
   ```

   Outputs `model_<arch>.h5` in this directory. On CPU on a MacBook Air
   (8GB), the full run (5 head epochs + 10 fine-tune epochs) takes roughly
   30-45 minutes on HAM10000 alone; expect longer (both per epoch and likely
   more epochs to converge) with BCN20000 added, since there's ~3x the data.
   Expect val accuracy around 70-75% on HAM10000 alone for the 7-class
   problem; adding BCN20000 gives the model more examples per class to learn
   from, which typically helps, but the exact gain depends on your run --
   watch `train_output*.log` rather than assuming a number. Both datasets are
   skewed toward benign nevi (`nv`), which `train.py` corrects for with class
   weighting, but this is a teaching example, not a clinical-grade
   classifier.

   Training images also get synthetic hair drawn onto ~50% of them
   (`HAIR_AUGMENT_PROB` / `HAIR_MAX_STRANDS` in `train.py`) -- real
   dermoscopic photos are frequently partly obscured by body hair, and a
   model that's never seen that during training tends to get thrown off by
   it. This only touches the training pipeline, not inference, so there's
   nothing to keep in sync on the client side.

   Two environment variables matter here:
   - `FORCE_CPU=1`: on Apple Silicon, `tensorflow-metal` GPU acceleration is
     fast for the training steps themselves but has been observed to hang
     indefinitely during the validation phase (TF 2.16 / tensorflow-metal
     1.2.0). If training stalls after the first epoch's steps complete with
     no progress for several minutes, kill it and rerun with `FORCE_CPU=1`.
   - `TF_USE_LEGACY_KERAS=1`: set unconditionally inside `train.py` itself
     (you don't need to pass it). TF 2.16 defaults to Keras 3, which
     serializes models (`InputLayer` config, functional-graph node format)
     in a way the browser-side `tfjs` runtime cannot parse; it fails with
     errors like `"An InputLayer should be passed either a batchInputShape
     or an inputShape"` or `"Corrupted configuration, expected array for
     nodeData"`. Training under legacy Keras 2 (the `tf_keras` package,
     installed as a `tensorflowjs` dependency) avoids this rather than
     patching the JSON after the fact. `convert_to_tfjs.py` sets the same
     flag, since the model must be loaded the same way it was saved.

4. **Convert to TensorFlow.js:**

   ```bash
   MODEL_ARCH=mobilenetv2 python convert_to_tfjs.py   # or efficientnetb0
   ```

   Writes `model.json` and weight shard `.bin` files into
   `public/model/<arch>/`. Restart (or just refresh) the Next.js dev server;
   the scan page will pick the model up automatically once it's listed in
   `src/lib/modelRegistry.ts`.

## Keeping preprocessing in sync

The client (`src/lib/clientModel.ts`) and `train.py` must apply identical
pixel preprocessing per architecture, or it silently produces garbage
predictions rather than an error:

- **mobilenetv2**: pixels resized to 224×224 and scaled to `[-1, 1]`
  (`pixel / 127.5 - 1`).
- **efficientnetb0**: pixels resized to 224×224, then `(pixel / 255 - mean) / var`
  using ImageNet mean/var constants. `tf.keras.applications.EfficientNetB0`'s
  built-in `Rescaling`/`Normalization` layers aren't portable to tfjs-layers
  (it can't deserialize `Normalization`), so `convert_to_tfjs.py` strips them
  from the exported graph and the client applies the equivalent closed-form
  transform instead. See `strip_efficientnet_preprocessing()` in
  `convert_to_tfjs.py`.

If you add a new architecture, check what preprocessing its
`tf.keras.applications.*` constructor expects and wire up both sides the
same way (`ARCH_CONFIG["rescale"]` in `train.py`, the `preprocessing` field
in `src/lib/modelRegistry.ts`).

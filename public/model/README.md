This directory is where trained TensorFlow.js models are loaded from at
runtime, one subdirectory per architecture (`<arch>/model.json` + weight
shard `.bin` files), e.g. `mobilenetv2/` and `efficientnetb0/`.

The list of architectures the app knows about lives in
`src/lib/modelRegistry.ts`: add an entry there for any new subdirectory you
generate. Run the training pipeline in `scripts/train_model/` to produce
each one (`MODEL_ARCH=<id> python train.py && MODEL_ARCH=<id> python
convert_to_tfjs.py`). See `scripts/train_model/README.md` for details.

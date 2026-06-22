This directory is where the trained TensorFlow.js model is loaded from at
runtime (`/model/model.json` + weight shard `.bin` files).

It is intentionally empty in the repository — run the training pipeline in
`scripts/train_model/` to generate `model.json` and the weight shards here.
See the top-level README for instructions.

# Retraining with a genuine held-out test set

**Goal:** replace "validation accuracy under a split that also informed
training-time decisions" with a real, never-seen-during-training test
figure.

**Time cost:** roughly 1-1.5 hours of CPU time for both architectures
combined, per the project's own README per-architecture estimate.

## 0. Back up what you have (don't skip this)

```bash
cd scripts/train_model
mkdir -p backup_85_15
cp manifest_train.csv manifest_val.csv model_mobilenetv2.h5 model_efficientnetb0.h5 backup_85_15/
```

## 1. Generate the 70:15:15 split

Move `prepare_data_3way.py` (created at repo root) into `scripts/train_model/`,
then:

```bash
python prepare_data_3way.py
```

## 2. Retrain both architectures on the new split

```bash
MODEL_ARCH=mobilenetv2 python train.py
MODEL_ARCH=efficientnetb0 python train.py
```

## 3. Patch and run evaluate.py against the real test set

Apply the changes in `evaluate_patch_notes.md`, then:

```bash
python evaluate.py --manifest manifest_test.csv
```

Rename the output:

```bash
mv evaluation_summary.md evaluation_summary_test.md
mv confusion_matrix_mobilenetv2.png confusion_matrix_mobilenetv2_test.png
mv confusion_matrix_efficientnetb0.png confusion_matrix_efficientnetb0_test.png
```

## 4. Keep the live site consistent

```bash
python convert_to_tfjs.py
git add public/model/
git commit -m "Retrain on 70:15:15 split with genuine held-out test set"
git push
```

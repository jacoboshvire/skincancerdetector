# SkinScan model evaluation

Held-out validation set: `manifest_val.csv` (14333 images).

Class order: `akiec` (Actinic keratoses / intraepithelial carcinoma), `bcc` (Basal cell carcinoma), `bkl` (Benign keratosis-like lesion), `df` (Dermatofibroma), `mel` (Melanoma), `nv` (Melanocytic nevus (common mole)), `vasc` (Vascular lesion).

| Model | Val accuracy | Malignant-vs-benign accuracy |
|---|---|---|
| mobilenetv2 | 65.478% | 80.255% |
| efficientnetb0 | 69.964% | 82.258% |

## mobilenetv2

```
              precision    recall  f1-score   support

       akiec      0.447     0.518     0.480      1024
         bcc      0.640     0.734     0.684      1982
         bkl      0.307     0.440     0.362      1047
          df      0.114     0.757     0.199       111
         mel      0.551     0.538     0.544      2543
          nv      0.918     0.717     0.805      7531
        vasc      0.314     0.905     0.466        95

    accuracy                          0.655     14333
   macro avg      0.470     0.658     0.506     14333
weighted avg      0.726     0.655     0.680     14333
```

![confusion matrix for mobilenetv2](confusion_matrix_mobilenetv2.png)

## efficientnetb0

```
              precision    recall  f1-score   support

       akiec      0.496     0.604     0.545      1024
         bcc      0.694     0.702     0.698      1982
         bkl      0.344     0.549     0.423      1047
          df      0.183     0.703     0.291       111
         mel      0.593     0.612     0.602      2543
          nv      0.926     0.760     0.835      7531
        vasc      0.497     0.916     0.644        95

    accuracy                          0.700     14333
   macro avg      0.533     0.692     0.577     14333
weighted avg      0.753     0.700     0.718     14333
```

![confusion matrix for efficientnetb0](confusion_matrix_efficientnetb0.png)

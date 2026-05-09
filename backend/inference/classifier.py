"""
Inference SVM klasifikasi tingkat degradasi.

Memuat artifact `models/svm_glcm.pkl` (dihasilkan oleh
`training.train_classifier`) dan melakukan klasifikasi dari raw bytes.

Jika model belum tersedia, `is_loaded()` akan mengembalikan False dan
endpoint API harus mengembalikan 503 dengan instruksi untuk training.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TypedDict

import joblib
import numpy as np

from training.extract_features import (
    GLCMFeatures,
    features_from_bytes,
)

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "svm_glcm.pkl"
METRICS_PATH = Path(__file__).resolve().parent.parent / "models" / "metrics.json"


class ClassifyOutput(TypedDict):
    label: str
    features: GLCMFeatures
    confidence: float


_bundle: dict | None = None


def _load() -> dict | None:
    global _bundle
    if _bundle is not None:
        return _bundle
    if not MODEL_PATH.exists():
        return None
    _bundle = joblib.load(MODEL_PATH)
    return _bundle


def is_loaded() -> bool:
    return _load() is not None


def model_info() -> dict:
    info: dict = {"model_path": str(MODEL_PATH), "loaded": is_loaded()}
    if METRICS_PATH.exists():
        try:
            info["metrics"] = json.loads(METRICS_PATH.read_text())
        except Exception:  # noqa: BLE001
            pass
    return info


def classify(image_bytes: bytes) -> ClassifyOutput:
    bundle = _load()
    if bundle is None:
        raise RuntimeError(
            "Model klasifikasi belum dilatih. Jalankan: "
            "`python -m training.train_classifier` di folder backend "
            "setelah mengisi folder dataset/."
        )

    vec, avg = features_from_bytes(image_bytes)
    X = vec.reshape(1, -1)

    model = bundle["model"]
    le = bundle["label_encoder"]

    pred_idx = int(model.predict(X)[0])
    label = str(le.inverse_transform([pred_idx])[0])

    confidence = 1.0
    try:
        proba = model.predict_proba(X)[0]
        confidence = float(np.max(proba))
    except Exception:  # noqa: BLE001
        pass

    # Normalisasi label ke kapital pertama agar konsisten dengan UI lama
    label_display = label.capitalize()

    return ClassifyOutput(
        label=label_display,
        features=avg,
        confidence=round(confidence, 4),
    )

"""
Pelatihan model klasifikasi tingkat degradasi citra foto lama:
GLCM (multi-distance, multi-angle) + statistik tekstur + SVM RBF.

Mengikuti metodologi proposal: pra-pemrosesan → ekstraksi fitur tekstur
GLCM (4 properti × 4 sudut) → SVM dengan pencarian hyperplane optimal
via GridSearchCV → evaluasi accuracy/precision/recall/F1 + confusion matrix.

Penambahan untuk meningkatkan akurasi (semuanya dalam koridor proposal):
  • multi-distance GLCM (1, 2, 4) untuk menangkap blur multi-skala
  • quantization 64 levels (matriks GLCM padat & stabil)
  • 8 fitur statistik pelengkap (Laplacian variance, Tenengrad, dll)
  • augmentasi training-time yang tidak mengubah label
  • GridSearch yang lebih luas + class_weight balanced

Penggunaan:
    cd backend
    python -m training.train_classifier
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import cv2
import joblib
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.svm import SVC

from training.extract_features import (
    FEATURE_NAMES,
    augmented_grays,
    extract_full_vector,
    features_from_path,
)

CLASSES = ["ringan", "sedang", "berat"]
IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def _list_files(dataset_dir: Path) -> tuple[list[Path], list[str], dict[str, int]]:
    files: list[Path] = []
    labels: list[str] = []
    counts: dict[str, int] = {}
    for cls in CLASSES:
        d = dataset_dir / cls
        if not d.exists():
            counts[cls] = 0
            print(f"  ! Folder kelas '{cls}' tidak ditemukan: {d}")
            continue
        cls_files = [
            p for p in sorted(d.iterdir())
            if p.is_file() and p.suffix.lower() in IMG_EXTS
        ]
        counts[cls] = len(cls_files)
        files.extend(cls_files)
        labels.extend([cls] * len(cls_files))
    return files, labels, counts


def _features_with_augmentation(file_path: Path) -> list[np.ndarray]:
    """Hasilkan ~11 vektor fitur dari satu citra (augmentasi label-preserving)."""
    img = cv2.imread(str(file_path), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Tidak dapat membaca: {file_path}")
    grays = augmented_grays(img)
    return [extract_full_vector(g) for g in grays]


def train(dataset_dir: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    print("[1/4] Loading dataset...")
    files, labels, counts = _list_files(dataset_dir)
    if not files:
        raise RuntimeError(
            "Dataset kosong. Letakkan gambar di "
            "backend/dataset/{ringan,sedang,berat}/ lalu jalankan ulang."
        )
    print(
        f"      {len(files)} file total → "
        + ", ".join(f"{c}: {counts.get(c, 0)}" for c in CLASSES)
    )

    if len(set(labels)) < 2:
        raise RuntimeError(
            f"Butuh minimal 2 kelas berisi gambar. Saat ini: {sorted(set(labels))}"
        )

    le = LabelEncoder()
    y_enc_files = le.fit_transform(labels)

    # --- Split di level FILE supaya augmentasi tidak bocor antar split ---
    test_size = 0.2 if len(files) >= 10 else 0.3
    files_train, files_test, y_train_files, y_test_files = train_test_split(
        files,
        y_enc_files,
        test_size=test_size,
        random_state=42,
        stratify=y_enc_files,
    )
    print(f"      train files={len(files_train)}  test files={len(files_test)}")

    # --- Ekstraksi fitur: train pakai augmentasi, test tanpa augmentasi ---
    print("[2/4] Ekstraksi fitur (GLCM multi-distance + statistik)...")
    X_train_list: list[np.ndarray] = []
    y_train_list: list[int] = []
    skipped = 0
    for fp, y in zip(files_train, y_train_files):
        try:
            for vec in _features_with_augmentation(fp):
                X_train_list.append(vec)
                y_train_list.append(int(y))
        except Exception as exc:  # noqa: BLE001
            skipped += 1
            print(f"      ! lewati {fp.name}: {exc}")

    X_test_list: list[np.ndarray] = []
    y_test_list: list[int] = []
    for fp, y in zip(files_test, y_test_files):
        try:
            X_test_list.append(features_from_path(str(fp)))
            y_test_list.append(int(y))
        except Exception as exc:  # noqa: BLE001
            skipped += 1
            print(f"      ! lewati {fp.name}: {exc}")

    X_train = np.asarray(X_train_list, dtype=np.float64)
    y_train = np.asarray(y_train_list)
    X_test = np.asarray(X_test_list, dtype=np.float64)
    y_test = np.asarray(y_test_list)

    print(
        f"      train samples (with augmentation)={len(X_train)} "
        f"(×{len(X_train) / max(len(files_train), 1):.1f})  "
        f"test samples={len(X_test)}  fitur/sampel={X_train.shape[1]}"
    )
    if skipped:
        print(f"      ! total skipped: {skipped}")

    # --- Sanity check: distribusi fitur train vs test ---
    # Kalau mean/std jauh berbeda → ada distribution shift / leakage halus.
    train_mean = X_train.mean(axis=0)
    test_mean = X_test.mean(axis=0)
    train_std = X_train.std(axis=0) + 1e-9
    z_shift = float(np.mean(np.abs((test_mean - train_mean) / train_std)))
    print(
        f"      [sanity] mean |z-shift| train↔test = {z_shift:.3f}  "
        f"(idealnya < 0.3; > 0.5 = curiga distribution shift)"
    )

    # --- Training: SVM RBF + GridSearchCV (lebih luas) ---
    print("[3/4] Training SVM (GridSearchCV) — pencarian hyperplane optimal...")
    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("svm", SVC(kernel="rbf", probability=True, random_state=42)),
    ])
    # Grid yang LEBIH KONSERVATIF — mencegah model terjebak di C ekstrem
    # (C=500, gamma=0.1 = tanda klasik overfitting pada fitur augmented).
    param_grid = {
        "svm__C": [0.5, 1, 2, 5, 10, 20, 50],
        "svm__gamma": ["scale", "auto", 0.001, 0.005, 0.01, 0.05],
        "svm__class_weight": [None, "balanced"],
    }
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    grid = GridSearchCV(
        pipe,
        param_grid,
        cv=cv,
        scoring="f1_macro",
        n_jobs=-1,
        refit=True,
        verbose=0,
    )
    grid.fit(X_train, y_train)
    best = grid.best_estimator_
    print(f"      best params: {grid.best_params_}")
    print(f"      cv f1_macro: {grid.best_score_:.4f}")

    # --- Evaluation ---
    print("[4/4] Evaluation:")
    y_pred = best.predict(X_test)

    acc = accuracy_score(y_test, y_pred)
    f1_macro = f1_score(y_test, y_pred, average="macro", zero_division=0)
    precision = precision_score(y_test, y_pred, average="macro", zero_division=0)
    recall = recall_score(y_test, y_pred, average="macro", zero_division=0)

    cm = confusion_matrix(y_test, y_pred, labels=range(len(le.classes_)))
    report = classification_report(
        y_test, y_pred, target_names=le.classes_, output_dict=True, zero_division=0
    )

    print(f"      Accuracy={acc:.4f}  Precision={precision:.4f}  Recall={recall:.4f}  F1={f1_macro:.4f}")
    print(f"      Confusion Matrix (labels={list(le.classes_)}):")
    for row in cm:
        print("        " + " ".join(f"{v:4d}" for v in row))

    # --- Persist artifacts ---
    model_path = out_dir / "svm_glcm.pkl"
    joblib.dump(
        {
            "model": best,
            "label_encoder": le,
            "feature_names": FEATURE_NAMES,
            "classes": list(le.classes_),
        },
        model_path,
    )

    metrics_path = out_dir / "metrics.json"
    metrics_path.write_text(
        json.dumps(
            {
                "accuracy": float(acc),
                "precision_macro": float(precision),
                "recall_macro": float(recall),
                "f1_macro": float(f1_macro),
                "best_params": grid.best_params_,
                "cv_score": float(grid.best_score_),
                "labels": list(le.classes_),
                "confusion_matrix": cm.tolist(),
                "classification_report": report,
                "dataset_counts": counts,
                "n_train_files": int(len(files_train)),
                "n_train_samples_after_aug": int(len(X_train)),
                "n_test": int(len(X_test)),
                "n_features": int(X_train.shape[1]),
                "trained_at": int(time.time()),
            },
            indent=2,
        )
    )

    elapsed = time.time() - t0
    print(f"\n  Model disimpan -> {model_path}")
    print(f"  Metrik disimpan -> {metrics_path}")
    print(f"  Selesai dalam {elapsed:.1f}s.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dataset", type=Path,
        default=Path(__file__).resolve().parent.parent / "dataset",
    )
    parser.add_argument(
        "--out", type=Path,
        default=Path(__file__).resolve().parent.parent / "models",
    )
    args = parser.parse_args()

    try:
        train(args.dataset, args.out)
    except Exception as exc:  # noqa: BLE001
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

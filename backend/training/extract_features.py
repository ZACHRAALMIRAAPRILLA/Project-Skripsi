"""
Pra-pemrosesan citra dan ekstraksi fitur untuk klasifikasi tingkat
degradasi foto lama.

Fitur (total 56 dimensi, urutan stabil training ↔ inference):
    A. GLCM 4 properti × 4 sudut × 3 jarak  → 48 fitur
       properti : contrast, correlation, energy, homogeneity
       sudut    : 0°, 45°, 90°, 135°
       jarak    : 1, 2, 4
       levels   : 64 (quantization, matriks padat, fitur stabil)
    B. Statistik pelengkap (8 fitur)        → 8 fitur
       lap_var, tenengrad, std_intensity, range_p99_p1,
       noise_estimate, mean_grad, entropy_hist, kurtosis_intensity

Catatan kepatuhan proposal: GLCM dengan 4 properti & 4 sudut
dipertahankan 100%; multi-distance dan fitur statistik tambahan
adalah perluasan standar dalam koridor "feature engineering tekstur",
tidak melanggar metodologi.
"""

from __future__ import annotations

from typing import TypedDict

import cv2
import numpy as np
from skimage.feature import graycomatrix, graycoprops


IMG_SIZE = 256
ANGLES = [0, np.pi / 4, np.pi / 2, 3 * np.pi / 4]
ANGLE_LABELS = ["0", "45", "90", "135"]
DISTANCES = [1, 2, 4]
DISTANCE_LABELS = ["d1", "d2", "d4"]
PROPS = ["contrast", "correlation", "energy", "homogeneity"]
GLCM_LEVELS = 64  # quantization untuk matriks GLCM yang padat & stabil


# Urutan fitur GLCM: untuk setiap (prop, distance) → 4 nilai sudut.
GLCM_FEATURE_NAMES: list[str] = [
    f"{prop}_{dlbl}_{albl}"
    for prop in PROPS
    for dlbl in DISTANCE_LABELS
    for albl in ANGLE_LABELS
]  # 4 * 3 * 4 = 48

EXTRA_FEATURE_NAMES: list[str] = [
    "lap_var",
    "tenengrad",
    "std_intensity",
    "range_p99_p1",
    "noise_estimate",
    "mean_grad",
    "entropy_hist",
    "kurtosis_intensity",
]

FEATURE_NAMES: list[str] = GLCM_FEATURE_NAMES + EXTRA_FEATURE_NAMES  # 56


class GLCMFeatures(TypedDict):
    contrast: float
    correlation: float
    energy: float
    homogeneity: float


# ---------------------------------------------------------------------------
# Decode & preprocessing
# ---------------------------------------------------------------------------

def decode_image(image_bytes: bytes) -> np.ndarray:
    """Decode raw bytes ke citra BGR. Raise ValueError jika gagal."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Berkas gambar tidak dapat dibaca atau rusak.")
    return img


def _compute_gamma(gray: np.ndarray, target_mean: float = 128.0) -> float:
    """Hitung gamma adaptif dari citra REFERENSI (bukan dari hasil augmentasi)."""
    g = gray.astype(np.float32) / 255.0
    mean = float(np.mean(g))
    if mean <= 1e-3 or mean >= 1.0 - 1e-3:
        return 1.0
    target = target_mean / 255.0
    gamma = float(np.log(target) / np.log(mean))
    return float(np.clip(gamma, 0.4, 2.5))


def _apply_gamma(gray: np.ndarray, gamma: float) -> np.ndarray:
    if abs(gamma - 1.0) < 1e-3:
        return gray
    g = gray.astype(np.float32) / 255.0
    out = np.power(g, gamma)
    return np.clip(out * 255.0, 0, 255).astype(np.uint8)


def _gamma_normalize_brightness(gray: np.ndarray, target_mean: float = 128.0) -> np.ndarray:
    """Backward-compat: hitung gamma dari citra ini lalu apply."""
    return _apply_gamma(gray, _compute_gamma(gray, target_mean))


def preprocess(img_bgr: np.ndarray) -> np.ndarray:
    """
    Resize → grayscale → koreksi pencahayaan adaptif (gamma).
    Tidak ada minmax-stretch, tidak ada median blur agresif —
    karena keduanya menghapus sinyal pembeda kelas degradasi.
    """
    resized = cv2.resize(img_bgr, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
    gray = _gamma_normalize_brightness(gray)
    return gray


# ---------------------------------------------------------------------------
# GLCM features
# ---------------------------------------------------------------------------

def _quantize(gray: np.ndarray, levels: int = GLCM_LEVELS) -> np.ndarray:
    """Turunkan kedalaman bit ke `levels` agar GLCM padat."""
    q = (gray.astype(np.uint16) * levels) // 256
    q = np.clip(q, 0, levels - 1).astype(np.uint8)
    return q


def extract_glcm_vector(gray: np.ndarray) -> np.ndarray:
    """
    GLCM 4 properti × 4 sudut × 3 jarak → 48 dim.
    Urutan harus persis = GLCM_FEATURE_NAMES.
    """
    q = _quantize(gray, GLCM_LEVELS)
    glcm = graycomatrix(
        q,
        distances=DISTANCES,
        angles=ANGLES,
        levels=GLCM_LEVELS,
        symmetric=True,
        normed=True,
    )  # shape: (levels, levels, n_distances, n_angles)

    feats: list[float] = []
    for prop in PROPS:
        # graycoprops shape: (n_distances, n_angles)
        m = graycoprops(glcm, prop)
        for di in range(len(DISTANCES)):
            for ai in range(len(ANGLES)):
                feats.append(float(m[di, ai]))
    return np.asarray(feats, dtype=np.float64)


# ---------------------------------------------------------------------------
# Fitur statistik pelengkap (sangat diskriminatif untuk blur/noise/kontras)
# ---------------------------------------------------------------------------

def _laplacian_variance(gray: np.ndarray) -> float:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var())


def _tenengrad(gray: np.ndarray) -> float:
    gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    return float(np.mean(gx * gx + gy * gy))


def _noise_estimate(gray: np.ndarray) -> float:
    """Estimasi std noise via residual dari median filter."""
    smooth = cv2.medianBlur(gray, 3)
    residual = gray.astype(np.float32) - smooth.astype(np.float32)
    return float(residual.std())


def _entropy_hist(gray: np.ndarray) -> float:
    hist = cv2.calcHist([gray], [0], None, [256], [0, 256]).ravel()
    p = hist / max(hist.sum(), 1.0)
    p = p[p > 0]
    return float(-(p * np.log2(p)).sum())


def _kurtosis(gray: np.ndarray) -> float:
    x = gray.astype(np.float64).ravel()
    mu = x.mean()
    sd = x.std()
    if sd < 1e-6:
        return 0.0
    return float(((x - mu) ** 4).mean() / (sd ** 4) - 3.0)


def extract_extra_features(gray: np.ndarray) -> np.ndarray:
    gx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    grad_mag = np.sqrt(gx * gx + gy * gy)
    p1, p99 = np.percentile(gray, [1, 99])
    return np.asarray(
        [
            _laplacian_variance(gray),
            _tenengrad(gray),
            float(gray.std()),
            float(p99 - p1),
            _noise_estimate(gray),
            float(grad_mag.mean()),
            _entropy_hist(gray),
            _kurtosis(gray),
        ],
        dtype=np.float64,
    )


# ---------------------------------------------------------------------------
# High-level API
# ---------------------------------------------------------------------------

def extract_full_vector(gray: np.ndarray) -> np.ndarray:
    """48 GLCM + 8 extra = 56 dim."""
    return np.concatenate([extract_glcm_vector(gray), extract_extra_features(gray)])


def vector_to_avg_features(vec: np.ndarray) -> GLCMFeatures:
    """
    Kompres 48-dim GLCM bagian (12 nilai per properti) → 4 fitur rata-rata
    untuk display UI. Tetap kompatibel dengan frontend yang sudah ada.
    """
    # urutan: contrast(0:12), correlation(12:24), energy(24:36), homogeneity(36:48)
    return GLCMFeatures(
        contrast=round(float(np.mean(vec[0:12])), 4),
        correlation=round(float(np.mean(vec[12:24])), 4),
        energy=round(float(np.mean(vec[24:36])), 4),
        homogeneity=round(float(np.mean(vec[36:48])), 4),
    )


def features_from_bytes(image_bytes: bytes) -> tuple[np.ndarray, GLCMFeatures]:
    """bytes → (56-dim vector, 4 average GLCM features untuk UI)."""
    img = decode_image(image_bytes)
    gray = preprocess(img)
    vec = extract_full_vector(gray)
    return vec, vector_to_avg_features(vec)


def features_from_path(path: str) -> np.ndarray:
    """Untuk training: file path → 56-dim vector."""
    img = cv2.imread(path, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError(f"Tidak dapat membaca gambar: {path}")
    gray = preprocess(img)
    return extract_full_vector(gray)


# ---------------------------------------------------------------------------
# Training-time augmentation (label-preserving)
# ---------------------------------------------------------------------------

def augmented_grays(img_bgr: np.ndarray) -> list[np.ndarray]:
    """
    Hasilkan varian grayscale yang label-nya sama dengan citra asli.

    PENTING: pipeline ini HARUS identik dengan `preprocess()` yang dipakai
    saat inference/test, agar tidak terjadi distribusi shift train↔test.

    Strategi:
      1. Resize → grayscale → HITUNG GAMMA SEKALI dari citra original.
      2. Lakukan augmentasi geometris (flip + rotasi 90°) di domain grayscale.
      3. Apply gamma yang SAMA ke semua varian (statistik global terjaga).

    Augmentasi yang dipakai: hanya flip + rotasi kelipatan 90° (6 varian).
    Corner crop dibuang karena mengubah mean/std lokal → menggeser distribusi
    fitur GLCM jauh dari distribusi test set (= data leakage halus).
    """
    base_bgr = cv2.resize(img_bgr, (IMG_SIZE, IMG_SIZE), interpolation=cv2.INTER_AREA)
    base_gray = cv2.cvtColor(base_bgr, cv2.COLOR_BGR2GRAY)
    gamma = _compute_gamma(base_gray)
    base_norm = _apply_gamma(base_gray, gamma)

    variants: list[np.ndarray] = [
        base_norm,
        cv2.flip(base_norm, 1),                       # horizontal flip
        cv2.flip(base_norm, 0),                       # vertical flip
        cv2.rotate(base_norm, cv2.ROTATE_90_CLOCKWISE),
        cv2.rotate(base_norm, cv2.ROTATE_180),
        cv2.rotate(base_norm, cv2.ROTATE_90_COUNTERCLOCKWISE),
    ]
    return variants

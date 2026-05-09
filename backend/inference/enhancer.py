"""
Penjernihan / restorasi citra foto lama.

Strategi adaptif berdasarkan kelas degradasi (hasil klasifikasi GLCM+SVM):
  • Ringan : classical CV (denoising ringan + CLAHE halus + sharpening)
  • Sedang : GFPGAN (jika tersedia) + classical post-process
  • Berat  : GFPGAN dengan weight kuat + denoising + CLAHE post-process

GFPGAN (https://github.com/TencentARC/GFPGAN) adalah model deep learning
khusus untuk restorasi wajah pada foto lama. Bila dependency / bobot
tidak tersedia, sistem fallback otomatis ke classical pipeline sehingga
endpoint /api/enhance tetap bekerja tanpa GPU.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Literal

import cv2
import numpy as np

from training.extract_features import decode_image

DegradationClass = Literal["Ringan", "Sedang", "Berat"]


# Parameter classical pipeline per-kelas
_PARAMS: dict[str, dict[str, float]] = {
    "ringan": {"denoise_h": 3.0, "clahe_clip": 1.8, "sharp_amount": 0.6, "gfpgan_weight": 0.0},
    "sedang": {"denoise_h": 7.0, "clahe_clip": 2.4, "sharp_amount": 0.8, "gfpgan_weight": 0.5},
    "berat":  {"denoise_h": 10.0, "clahe_clip": 3.0, "sharp_amount": 1.0, "gfpgan_weight": 0.8},
}

GFPGAN_MODEL_URL = (
    "https://github.com/TencentARC/GFPGAN/releases/download/v1.3.4/GFPGANv1.4.pth"
)
GFPGAN_MODEL_DIR = Path(__file__).resolve().parent.parent / "models" / "gfpgan"
GFPGAN_MODEL_PATH = GFPGAN_MODEL_DIR / "GFPGANv1.4.pth"

_gfpgan_restorer = None  # cache singleton


# ---------------------------------------------------------------------------
# Classical helpers
# ---------------------------------------------------------------------------

def _gray_world_white_balance(img: np.ndarray) -> np.ndarray:
    result = img.astype(np.float32)
    means = result.reshape(-1, 3).mean(axis=0)
    gray = means.mean()
    scale = gray / np.maximum(means, 1e-6)
    result = result * scale
    return np.clip(result, 0, 255).astype(np.uint8)


def _clahe_lab(img: np.ndarray, clip: float) -> np.ndarray:
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(8, 8))
    l2 = clahe.apply(l)
    merged = cv2.merge((l2, a, b))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def _unsharp(img: np.ndarray, amount: float) -> np.ndarray:
    blurred = cv2.GaussianBlur(img, (0, 0), sigmaX=1.2)
    sharp = cv2.addWeighted(img, 1 + amount, blurred, -amount, 0)
    return np.clip(sharp, 0, 255).astype(np.uint8)


def _classical_pipeline(img: np.ndarray, p: dict[str, float], heavy: bool) -> np.ndarray:
    denoised = cv2.fastNlMeansDenoisingColored(
        img, None,
        h=float(p["denoise_h"]),
        hColor=float(p["denoise_h"]),
        templateWindowSize=7,
        searchWindowSize=21,
    )
    if heavy:
        denoised = cv2.medianBlur(denoised, 3)
    contrasted = _clahe_lab(denoised, float(p["clahe_clip"]))
    balanced = _gray_world_white_balance(contrasted)
    return _unsharp(balanced, float(p["sharp_amount"]))


# ---------------------------------------------------------------------------
# GFPGAN (opsional)
# ---------------------------------------------------------------------------

def _download_gfpgan_weights() -> bool:
    """Auto-download bobot GFPGAN ke folder models/gfpgan/ bila belum ada."""
    if GFPGAN_MODEL_PATH.exists():
        return True
    try:
        import urllib.request
        GFPGAN_MODEL_DIR.mkdir(parents=True, exist_ok=True)
        print(f"[enhancer] Mengunduh bobot GFPGAN ke {GFPGAN_MODEL_PATH} ...")
        urllib.request.urlretrieve(GFPGAN_MODEL_URL, GFPGAN_MODEL_PATH)
        return GFPGAN_MODEL_PATH.exists()
    except Exception as exc:  # noqa: BLE001
        print(f"[enhancer] Gagal unduh bobot GFPGAN: {exc}")
        return False


def _get_gfpgan_restorer():
    """Singleton GFPGANer. Return None bila dependency / bobot tidak ada."""
    global _gfpgan_restorer
    if _gfpgan_restorer is not None:
        return _gfpgan_restorer

    try:
        from gfpgan import GFPGANer  # type: ignore
    except Exception:
        return None

    if not _download_gfpgan_weights():
        return None

    try:
        # arch='clean' untuk model v1.4. CPU-friendly: bg_upsampler=None.
        _gfpgan_restorer = GFPGANer(
            model_path=str(GFPGAN_MODEL_PATH),
            upscale=2,
            arch="clean",
            channel_multiplier=2,
            bg_upsampler=None,
        )
        return _gfpgan_restorer
    except Exception as exc:  # noqa: BLE001
        print(f"[enhancer] GFPGAN init gagal: {exc}")
        return None


def _try_gfpgan(img_bgr: np.ndarray, weight: float) -> np.ndarray | None:
    """Jalankan GFPGAN. Return None bila tidak tersedia atau gagal."""
    restorer = _get_gfpgan_restorer()
    if restorer is None:
        return None
    try:
        # GFPGANer.enhance return (cropped_faces, restored_faces, restored_img)
        _, _, restored = restorer.enhance(
            img_bgr,
            has_aligned=False,
            only_center_face=False,
            paste_back=True,
            weight=float(weight),
        )
        if restored is None:
            return None
        return restored
    except Exception as exc:  # noqa: BLE001
        print(f"[enhancer] GFPGAN enhance gagal: {exc}")
        return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def enhance(image_bytes: bytes, degradation_class: str | None = None) -> np.ndarray:
    """
    Restorasi citra. `degradation_class` opsional ('Ringan'/'Sedang'/'Berat').
    Default 'sedang'.
    """
    img = decode_image(image_bytes)

    cls = (degradation_class or "sedang").strip().lower()
    if cls not in _PARAMS:
        cls = "sedang"
    p = _PARAMS[cls]

    use_gfpgan = cls in ("sedang", "berat") and os.getenv("DISABLE_GFPGAN") != "1"

    if use_gfpgan:
        restored = _try_gfpgan(img, weight=float(p["gfpgan_weight"]))
        if restored is not None:
            # Post-process ringan agar konsisten dengan pipeline
            if cls == "berat":
                restored = _clahe_lab(restored, clip=float(p["clahe_clip"]) * 0.7)
            return restored
        # fallback ke classical bila GFPGAN tidak tersedia

    return _classical_pipeline(img, p, heavy=(cls == "berat"))


def encode_png(img: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".png", img)
    if not ok:
        raise RuntimeError("Gagal mengenkode hasil enhancement ke PNG.")
    return buf.tobytes()

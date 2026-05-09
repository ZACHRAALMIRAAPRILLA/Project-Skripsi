"""
FastAPI server untuk Klasifikasi Degradasi Foto Lama + Penjernihan.

Endpoints:
    GET  /                  Health check
    GET  /api/health        Status model + dataset
    GET  /api/metrics       Metrik evaluasi model terakhir
    POST /api/classify      Klasifikasi tingkat degradasi (GLCM + SVM)
    POST /api/enhance       Penjernihan citra (PNG stream)
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from inference import classifier as clf
from inference import enhancer as enh

app = FastAPI(
    title="Klasifikasi Degradasi Foto Lama API",
    version="2.0.0",
    description=(
        "Klasifikasi tingkat degradasi foto lama (GLCM + SVM) dan "
        "penjernihan citra berbasis classical CV + Real-ESRGAN opsional."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATASET_DIR = Path(__file__).resolve().parent / "dataset"
METRICS_PATH = Path(__file__).resolve().parent / "models" / "metrics.json"


def _dataset_counts() -> dict[str, int]:
    counts: dict[str, int] = {}
    for cls in ("ringan", "sedang", "berat"):
        d = DATASET_DIR / cls
        if d.exists():
            counts[cls] = sum(
                1 for p in d.iterdir()
                if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
            )
        else:
            counts[cls] = 0
    return counts


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "ok", "service": "klasifikasi-degradasi-foto-lama"}


@app.get("/api/health")
def health() -> dict:
    return {
        "classifier_loaded": clf.is_loaded(),
        "dataset_counts": _dataset_counts(),
    }


@app.get("/api/metrics")
def metrics() -> dict:
    if not METRICS_PATH.exists():
        raise HTTPException(
            status_code=404,
            detail="Belum ada metrik. Latih model terlebih dahulu.",
        )
    try:
        return json.loads(METRICS_PATH.read_text())
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Gagal membaca metrik: {exc}") from exc


def _validate_image_upload(file: UploadFile) -> None:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail="Format berkas tidak didukung. Mohon unggah berkas gambar.",
        )


@app.post("/api/classify")
async def classify(file: UploadFile = File(...)) -> dict:
    _validate_image_upload(file)
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Berkas kosong.")

    if not clf.is_loaded():
        raise HTTPException(
            status_code=503,
            detail=(
                "Model belum dilatih. Letakkan dataset di "
                "backend/dataset/{ringan,sedang,berat}/ lalu jalankan: "
                "python -m training.train_classifier"
            ),
        )

    try:
        result = clf.classify(image_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Gagal memproses gambar: {exc}") from exc

    return {
        "class": result["label"],
        "features": result["features"],
        "confidence": result["confidence"],
    }


@app.post("/api/enhance")
async def enhance_endpoint(
    file: UploadFile = File(...),
    degradation_class: Optional[str] = Form(default=None),
) -> Response:
    _validate_image_upload(file)
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Berkas kosong.")

    try:
        result_img = enh.enhance(image_bytes, degradation_class=degradation_class)
        png = enh.encode_png(result_img)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Gagal menjernihkan gambar: {exc}") from exc

    return Response(
        content=png,
        media_type="image/png",
        headers={"X-Degradation-Class": str(degradation_class or "sedang")},
    )

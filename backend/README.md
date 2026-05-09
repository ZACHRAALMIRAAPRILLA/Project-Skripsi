# Backend — Klasifikasi Degradasi Foto Lama + Penjernihan

Backend FastAPI untuk dua kapabilitas:

1. **Klasifikasi tingkat degradasi** (Ringan / Sedang / Berat) dengan
   pipeline GLCM + SVM persis sesuai metodologi proposal.
2. **Penjernihan citra** (image restoration) dengan classical CV
   (denoising + CLAHE + sharpening + white balance) dan opsi deep
   super-resolution Real-ESRGAN.

---

## 1. Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate          # macOS/Linux
# venv\Scripts\activate            # Windows

pip install -r requirements.txt
```

> **Opsional — GFPGAN (deep face restoration).** Aplikasi tetap
> berjalan tanpa ini; pipeline classical jadi fallback. Untuk
> mengaktifkan penjernihan level GFPGAN:
>
> ```bash
> pip install torch torchvision basicsr facexlib gfpgan
> ```
>
> Bobot `GFPGANv1.4.pth` akan otomatis di-download saat pertama kali
> endpoint `/api/enhance` dipanggil (disimpan di `backend/models/gfpgan/`).
> Set env `DISABLE_GFPGAN=1` untuk memaksa pipeline classical.

---

## 2. Siapkan Dataset

Letakkan citra ke folder berlabel:

```
backend/dataset/
├── ringan/   # foto dengan degradasi ringan (blur kecil)
├── sedang/   # blur + noise sedang
└── berat/    # blur kuat, noise tinggi, kerusakan visual
```

Format yang didukung: `.jpg`, `.jpeg`, `.png`, `.bmp`, `.webp`.

Rekomendasi: minimal **50 gambar per kelas** untuk hasil yang stabil.
Dataset bisa kombinasi sumber publik (Kaggle "Old Photo") dan dataset
mandiri (foto dimanipulasi terkontrol: blur, noise, penurunan kontras).

---

## 3. Latih Model (Training Phase)

```bash
cd backend
python -m training.train_classifier
```

Pipeline training (sesuai proposal, dioptimasi untuk akurasi tinggi):

1. Load dataset dari folder berlabel
2. Pra-pemrosesan: resize 256×256 → grayscale → koreksi pencahayaan
   adaptif via gamma correction (TIDAK melakukan minmax-stretch agar
   sinyal kontras-rendah pada degradasi berat tetap terdeteksi)
3. Ekstraksi fitur tekstur (56 dimensi total):
   - **GLCM** 4 properti (contrast, correlation, energy, homogeneity)
     × 4 sudut (0°, 45°, 90°, 135°) × 3 jarak (1, 2, 4), levels=64
     → 48 fitur
   - **Statistik pelengkap** (8 fitur): Laplacian variance, Tenengrad,
     std intensitas, range p99-p1, noise estimate, mean gradient,
     entropi histogram, kurtosis intensitas
4. Augmentasi training-time label-preserving (flip, rotasi 90°, crop)
   → ≈11× sampel training tanpa mengubah label degradasi
5. Stratified split 80/20 di level FILE (mencegah augmentation leakage)
6. SVM RBF dengan `GridSearchCV` 5-fold (C, gamma, class_weight)
7. Evaluasi: accuracy, precision, recall, F1 (macro), confusion matrix

Output:

- `backend/models/svm_glcm.pkl` — model + scaler + label encoder
- `backend/models/metrics.json` — semua metrik + confusion matrix

Re-training cukup jalankan ulang command di atas.

---

## 4. Jalankan Server

```bash
uvicorn main:app --reload --port 8000
```

Server tersedia di `http://localhost:8000`. Docs interaktif:
`http://localhost:8000/docs`.

---

## 5. Endpoints

| Method | Path              | Tujuan |
|--------|-------------------|--------|
| GET    | `/`               | Health check |
| GET    | `/api/health`     | Status model + jumlah dataset |
| GET    | `/api/metrics`    | Metrik evaluasi model terakhir |
| POST   | `/api/classify`   | Klasifikasi degradasi (multipart `file`) |
| POST   | `/api/enhance`    | Penjernihan citra (return PNG stream) |

### `POST /api/classify`

Form data: `file=<image>`

Response:

```json
{
  "class": "Ringan",
  "features": {
    "contrast": 12.34,
    "correlation": 0.98,
    "energy": 0.41,
    "homogeneity": 0.87
  },
  "confidence": 0.92
}
```

Bila model belum dilatih → HTTP 503 dengan instruksi training.

### `POST /api/enhance`

Form data: `file=<image>` + opsional `degradation_class=Ringan|Sedang|Berat`

Response: `image/png` (binary). Frontend cukup `URL.createObjectURL(blob)`.

---

## 6. Frontend

Frontend membaca `VITE_API_URL` (default `http://localhost:8000`).
Setelah klasifikasi muncul, panel "Saran Penjernihan" memanggil
`/api/enhance` dan menampilkan perbandingan before/after.

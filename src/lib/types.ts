export type Verdict = "Ringan" | "Sedang" | "Berat";

export interface GLCMFeatures {
  contrast: number;
  correlation: number;
  energy: number;
  homogeneity: number;
}

export interface ClassifyResponse {
  class: Verdict;
  features: GLCMFeatures;
  confidence?: number;
}

// ---------- Validation ----------

export const ACCEPTED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/bmp",
] as const;

export const ACCEPTED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "bmp"];

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_BATCH_FILES = 10;

export interface FileValidationError {
  file: File;
  reason: string;
}

export function validateImageFile(file: File): string | null {
  const lowerName = file.name.toLowerCase();
  const ext = lowerName.includes(".")
    ? lowerName.slice(lowerName.lastIndexOf(".") + 1)
    : "";

  const mimeOk = (ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type);
  const extOk = ACCEPTED_EXTENSIONS.includes(ext);

  if (!mimeOk && !extOk) {
    return `Format tidak didukung. Gunakan ${ACCEPTED_EXTENSIONS
      .map((e) => e.toUpperCase())
      .join(", ")}.`;
  }
  if (file.size === 0) {
    return "Berkas kosong atau rusak.";
  }
  if (file.size > MAX_FILE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return `Ukuran berkas ${sizeMb} MB melebihi batas 10 MB.`;
  }
  return null;
}

export function partitionFiles(files: File[]): {
  valid: File[];
  invalid: FileValidationError[];
} {
  const valid: File[] = [];
  const invalid: FileValidationError[] = [];
  for (const f of files) {
    const err = validateImageFile(f);
    if (err) invalid.push({ file: f, reason: err });
    else valid.push(f);
  }
  return { valid, invalid };
}

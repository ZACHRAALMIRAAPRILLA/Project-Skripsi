import type { ClassifyResponse, Verdict } from "./types";

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000";

async function extractError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { detail?: string; message?: string };
    return data.detail ?? data.message ?? fallback;
  } catch {
    return fallback;
  }
}

export async function classifyImage(file: File): Promise<ClassifyResponse> {
  const formData = new FormData();
  formData.append("file", file);

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/classify`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(
      "Tidak dapat terhubung ke server AI. Pastikan backend berjalan di " +
        API_URL,
    );
  }

  if (!res.ok) {
    throw new Error(await extractError(res, "Terjadi kesalahan saat menganalisis foto."));
  }

  return (await res.json()) as ClassifyResponse;
}

export async function enhanceImage(
  file: File,
  degradationClass?: Verdict,
): Promise<Blob> {
  const formData = new FormData();
  formData.append("file", file);
  if (degradationClass) {
    formData.append("degradation_class", degradationClass);
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/enhance`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw new Error(
      "Tidak dapat terhubung ke server AI. Pastikan backend berjalan di " +
        API_URL,
    );
  }

  if (!res.ok) {
    throw new Error(await extractError(res, "Gagal menjernihkan foto."));
  }

  return await res.blob();
}

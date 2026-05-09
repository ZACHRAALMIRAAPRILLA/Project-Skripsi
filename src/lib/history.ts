import type { ClassifyResponse, Verdict } from "./types";

export interface HistoryEntry {
  id: string;
  fileName: string;
  thumbnail: string; // data URL (downscaled)
  verdict: Verdict;
  features: ClassifyResponse["features"];
  createdAt: number;
}

const KEY = "klasifikasi-history-v1";
const MAX_ENTRIES = 24;

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function loadHistory(): HistoryEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    window.dispatchEvent(new CustomEvent("history-updated"));
  } catch {
    // Quota exceeded — drop oldest half and retry once
    try {
      const trimmed = entries.slice(0, Math.floor(MAX_ENTRIES / 2));
      localStorage.setItem(KEY, JSON.stringify(trimmed));
      window.dispatchEvent(new CustomEvent("history-updated"));
    } catch {
      // give up silently
    }
  }
}

export function addHistoryEntry(entry: HistoryEntry) {
  const current = loadHistory();
  saveHistory([entry, ...current.filter((e) => e.id !== entry.id)]);
}

export function deleteHistoryEntry(id: string) {
  saveHistory(loadHistory().filter((e) => e.id !== id));
}

export function clearHistory() {
  saveHistory([]);
}

/**
 * Downscale an image file to a small JPEG data URL suitable for storage.
 * Targets max ~480px on the longest edge.
 */
export async function makeThumbnail(file: File, maxEdge = 480): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const ratio = Math.min(1, maxEdge / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * ratio));
        const h = Math.max(1, Math.round(img.height * ratio));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas tidak tersedia");
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Gagal membaca gambar untuk thumbnail"));
    };
    img.src = url;
  });
}

import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Trash2,
  ImageOff,
  History as HistoryIcon,
  X,
  Activity,
  Link2,
  Zap,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/classifier/AppHeader";
import { VerdictBadge } from "@/components/classifier/VerdictBadge";
import {
  clearHistory,
  deleteHistoryEntry,
  loadHistory,
  type HistoryEntry,
} from "@/lib/history";
import { FEATURE_META } from "@/lib/feature-meta";
import type { Verdict } from "@/lib/types";

export const Route = createFileRoute("/riwayat")({
  head: () => ({
    meta: [
      { title: "Riwayat Klasifikasi  Degradasi.AI" },
      {
        name: "description",
        content:
          "Lihat hasil klasifikasi degradasi foto sebelumnya. Tersimpan otomatis di perangkat Anda.",
      },
      { property: "og:title", content: "Riwayat Klasifikasi Degradasi.AI" },
      {
        property: "og:description",
        content:
          "Riwayat hasil analisis GLCM + SVM untuk foto-foto yang pernah Anda unggah.",
      },
    ],
  }),
  component: RiwayatPage,
});

const VERDICT_COLOR: Record<Verdict, string> = {
  Ringan: "var(--verdict-light)",
  Sedang: "var(--verdict-medium)",
  Berat: "var(--verdict-heavy)",
};

const ICON_BY_KEY = {
  contrast: Activity,
  correlation: Link2,
  energy: Zap,
  homogeneity: Layers,
} as const;

function RiwayatPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [active, setActive] = useState<HistoryEntry | null>(null);

  useEffect(() => {
    setEntries(loadHistory());
    const handler = () => setEntries(loadHistory());
    window.addEventListener("history-updated", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("history-updated", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const handleDelete = (id: string) => {
    deleteHistoryEntry(id);
    setEntries(loadHistory());
    if (active?.id === id) setActive(null);
    toast.success("Entri riwayat dihapus.");
  };

  const handleClear = () => {
    if (entries.length === 0) return;
    if (!window.confirm("Hapus seluruh riwayat klasifikasi?")) return;
    clearHistory();
    setEntries([]);
    setActive(null);
    toast.success("Riwayat dikosongkan.");
  };

  return (
    <main className="relative min-h-screen w-full flex flex-col">
      <AppHeader />

      <section className="relative z-10 flex-1 w-full max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Riwayat
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-gradient">
              Klasifikasi Sebelumnya
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {entries.length === 0
                ? "Belum ada hasil tersimpan."
                : `${entries.length} hasil tersimpan di perangkat Anda.`}
            </p>
          </div>

          {entries.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-2 self-start sm:self-auto rounded-lg glass border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Semua
            </button>
          )}
        </div>

        {entries.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {entries.map((entry, idx) => (
              <HistoryCard
                key={entry.id}
                entry={entry}
                delay={idx * 0.03}
                onOpen={() => setActive(entry)}
                onDelete={() => handleDelete(entry.id)}
              />
            ))}
          </div>
        )}
      </section>

      {active && <DetailModal entry={active} onClose={() => setActive(null)} />}
    </main>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl glass-strong p-12 text-center max-w-xl mx-auto"
    >
      <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-5">
        <HistoryIcon className="w-7 h-7 text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        Belum ada riwayat
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Setiap foto yang Anda klasifikasi akan otomatis tersimpan di sini agar
        bisa dilihat lagi tanpa perlu mengunggah ulang.
      </p>
    </motion.div>
  );
}

function HistoryCard({
  entry,
  delay,
  onOpen,
  onDelete,
}: {
  entry: HistoryEntry;
  delay: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const color = VERDICT_COLOR[entry.verdict];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="group relative rounded-2xl glass overflow-hidden shadow-soft hover:shadow-glow transition-shadow"
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left"
      >
        <div className="aspect-[4/3] bg-background/40 overflow-hidden">
          <img
            src={entry.thumbnail}
            alt={entry.fileName}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        </div>
        <div className="p-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{
                color,
                background: `color-mix(in oklab, ${color} 14%, transparent)`,
                border: `1px solid color-mix(in oklab, ${color} 32%, transparent)`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: color }}
              />
              {entry.verdict}
            </span>
            <span className="text-[11px] text-muted-foreground ml-auto">
              {formatRelative(entry.createdAt)}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium text-foreground truncate">
            {entry.fileName}
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Hapus"
        className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-background/70 backdrop-blur border border-border opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

function DetailModal({
  entry,
  onClose,
}: {
  entry: HistoryEntry;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-background/80 backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl glass-strong shadow-elegant"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-lg glass flex items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-6 p-5 sm:p-7">
          <div className="rounded-2xl overflow-hidden bg-background/40">
            <img
              src={entry.thumbnail}
              alt={entry.fileName}
              className="w-full h-auto max-h-[60vh] object-contain"
            />
          </div>
          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs text-muted-foreground truncate">
                {entry.fileName}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {new Date(entry.createdAt).toLocaleString("id-ID")}
              </p>
            </div>
            <VerdictBadge verdict={entry.verdict} />
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2 px-1">
                Fitur Tekstur GLCM
              </p>
              <div className="grid grid-cols-2 gap-3">
                {FEATURE_META.map((meta) => {
                  const Icon = ICON_BY_KEY[meta.key];
                  return (
                    <div
                      key={meta.key}
                      className="rounded-xl glass p-4"
                      title={meta.description}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-3.5 h-3.5 text-primary" />
                        <span className="text-xs text-muted-foreground">
                          {meta.englishLabel}
                        </span>
                      </div>
                      <p className="text-xl font-semibold tabular-nums">
                        {entry.features[meta.key].toFixed(4)}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                        {meta.short}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "baru saja";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} jam lalu`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days} hari lalu`;
  return new Date(ts).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// silence unused-icon TS warnings (used in fallback paths)
void ImageOff;

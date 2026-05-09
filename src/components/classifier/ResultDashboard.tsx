import { motion } from "framer-motion";
import {
  RotateCcw,
  Download,
  Activity,
  Link2,
  Zap,
  Layers,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ClassifyResponse } from "@/lib/types";
import { VerdictBadge } from "./VerdictBadge";
import { FeatureCard } from "./FeatureCard";
import { EnhancePanel } from "./EnhancePanel";
import { FEATURE_META } from "@/lib/feature-meta";

const ICON_BY_KEY = {
  contrast: Activity,
  correlation: Link2,
  energy: Zap,
  homogeneity: Layers,
} as const;

export interface ResultItem {
  id: string;
  fileName: string;
  previewUrl: string;
  file?: File;
  status: "done" | "error";
  result?: ClassifyResponse;
  error?: string;
}

interface ResultDashboardProps {
  items: ResultItem[];
  onReset: () => void;
}

export function ResultDashboard({ items, onReset }: ResultDashboardProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = items[activeIdx] ?? items[0];

  const successCount = useMemo(
    () => items.filter((i) => i.status === "done").length,
    [items],
  );

  const handleDownload = () => {
    if (!active) return;
    const a = document.createElement("a");
    a.href = active.previewUrl;
    a.download = active.fileName || "foto.jpg";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="w-full"
    >
      <div className="text-center mb-8">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Analisis Selesai
        </p>
        <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-primary">
          Hasil Klasifikasi
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {successCount} dari {items.length} foto berhasil dianalisis
        </p>
      </div>

      {/* Thumbnail strip — only when batch */}
      {items.length > 1 && (
        <div className="mb-8 flex items-center justify-center gap-2 overflow-x-auto pb-2">
          {items.map((it, idx) => {
            const isActive = idx === activeIdx;
            return (
              <button
                key={it.id}
                type="button"
                onClick={() => setActiveIdx(idx)}
                className={`relative shrink-0 rounded-xl overflow-hidden border-2 transition-all
                  ${isActive ? "border-primary " : "border-border hover:border-primary/50 opacity-70 hover:opacity-100"}
                `}
                style={{ width: 64, height: 64 }}
              >
                <img
                  src={it.previewUrl}
                  alt={it.fileName}
                  className="w-full h-full object-cover"
                />
                {it.status === "error" && (
                  <div className="absolute inset-0 bg-destructive/40 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4 text-destructive-foreground" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!active && null}

      {active && active.status === "error" && (
        <div className="rounded-2xl  p-8 text-center max-w-lg mx-auto">
          <div className="mx-auto w-12 h-12 rounded-xl bg-destructive/15 border border-destructive/30 flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            Gagal menganalisis foto
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">{active.error}</p>
          <p className="mt-2 text-xs text-muted-foreground truncate">
            {active.fileName}
          </p>
        </div>
      )}

      {active && active.status === "done" && active.result && (
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-8 lg:gap-10 items-start">
          {/* Image */}
          <motion.div
            key={active.id}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="relative rounded-3xl glass-strong p-3 "
          >
            <div
              aria-hidden
              className="absolute -inset-px rounded-3xl pointer-events-none"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in oklab, var(--primary) 40%, transparent), transparent 50%, color-mix(in oklab, var(--primary-glow) 30%, transparent))",
                padding: 1,
                WebkitMask:
                  "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
              }}
            />
            <div className="rounded-2xl overflow-hidden bg-background/40">
              <img
                src={active.previewUrl}
                alt={active.fileName}
                className="w-full h-auto max-h-140 object-fill"
              />
            </div>
            <div className="mt-3 px-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground truncate">
                {active.fileName}
              </p>
              {items.length > 1 && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveIdx((i) => (i - 1 + items.length) % items.length)
                    }
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Foto sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs text-muted-foreground tabular-nums px-1">
                    {activeIdx + 1}/{items.length}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveIdx((i) => (i + 1) % items.length)
                    }
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-accent/40 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Foto berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Data */}
          <div key={`data-${active.id}`} className="flex flex-col gap-5">
            <VerdictBadge verdict={active.result.class} />

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 px-1">
                Fitur Tekstur GLCM
              </p>
              <div className="grid grid-cols-2 gap-4">
                {FEATURE_META.map((meta, idx) => (
                  <FeatureCard
                    key={meta.key}
                    label={meta.label}
                    englishLabel={meta.englishLabel}
                    value={active.result!.features[meta.key]}
                    icon={ICON_BY_KEY[meta.key]}
                    short={meta.short}
                    description={meta.description}
                    delay={0.05 + idx * 0.05}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mt-2">
              <button
                type="button"
                onClick={onReset}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <RotateCcw className="w-4 h-4" />
                Klasifikasikan Foto Lain
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl glass border border-border px-6 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent/40"
              >
                <Download className="w-4 h-4" />
                Unduh Foto
              </button>
            </div>

          </div>
        </div>
      )}
    </motion.div>
  );
}

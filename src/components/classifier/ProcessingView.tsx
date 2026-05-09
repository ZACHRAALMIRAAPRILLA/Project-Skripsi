import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertCircle, ImageIcon } from "lucide-react";

const STEPS = [
  "Mengonversi ke Grayscale...",
  "Menerapkan Median Filter (Reduksi Noise)...",
  "Menormalisasi Intensitas Cahaya...",
  "Mengekstraksi Fitur Tekstur GLCM...",
  "Menghitung Prediksi SVM...",
];

export type BatchItemStatus = "pending" | "processing" | "done" | "error";

export interface BatchItem {
  id: string;
  fileName: string;
  previewUrl: string;
  status: BatchItemStatus;
  error?: string;
}

interface ProcessingViewProps {
  items: BatchItem[];
  currentIndex: number; // index of currently processing item, -1 if none
  backgroundUrl?: string; // blurred background image
}

export function ProcessingView({
  items,
  currentIndex,
  backgroundUrl,
}: ProcessingViewProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
    const id = window.setInterval(() => {
      setStep((s) => (s + 1) % STEPS.length);
    }, 1500);
    return () => window.clearInterval(id);
  }, [currentIndex]);

  const total = items.length;
  const completed = items.filter(
    (i) => i.status === "done" || i.status === "error",
  ).length;
  const progressPct = total === 0 ? 0 : (completed / total) * 100;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="fixed inset-0 z-30 flex items-center justify-center px-4"
    >
      {backgroundUrl && (
        <div
          aria-hidden
          className="absolute inset-0 bg-cover bg-center scale-110"
          style={{
            backgroundImage: `url(${backgroundUrl})`,
            filter: "blur(40px) brightness(0.35) saturate(1.1)",
          }}
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, oklch(0.13 0.02 260 / 0.88) 70%)",
        }}
      />

      <div className="relative w-full max-w-md flex flex-col items-center text-center">
        {/* Spinner */}
        <div className="relative w-24 h-24 mb-7">
          <svg
            viewBox="0 0 100 100"
            className="absolute inset-0 w-full h-full -rotate-90"
          >
            <circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.12"
              strokeWidth="3"
              className="text-foreground"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="44"
              fill="none"
              stroke="url(#spinner-gradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="80 200"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.4, ease: "linear", repeat: Infinity }}
              style={{ transformOrigin: "50% 50%" }}
            />
            <defs>
              <linearGradient
                id="spinner-gradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="oklch(0.62 0.21 25)" />
                <stop offset="100%" stopColor="oklch(0.7 0.22 25)" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-foreground tabular-nums">
            {Math.min(currentIndex + 1, total)}/{total}
          </div>
        </div>

        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-3">
          Menganalisis Foto
        </p>

        <div className="h-7 relative w-full">
          <AnimatePresence mode="wait">
            <motion.p
              key={step + "-" + currentIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0 text-base sm:text-lg font-medium text-foreground"
            >
              {STEPS[step]}
            </motion.p>
          </AnimatePresence>
        </div>

        {/* Overall progress bar */}
        <div className="mt-7 w-full">
          <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-primary"
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {completed} dari {total} foto selesai
          </p>
        </div>

        {/* Per-file list */}
        <div className="mt-6 w-full glass rounded-xl p-2 max-h-56 overflow-y-auto">
          <ul className="text-left">
            {items.map((it, idx) => (
              <li
                key={it.id}
                className="flex items-center gap-3 px-2 py-1.5 rounded-lg"
              >
                <div className="w-8 h-8 rounded-md overflow-hidden bg-foreground/5 flex items-center justify-center shrink-0">
                  {it.previewUrl ? (
                    <img
                      src={it.previewUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <span className="flex-1 truncate text-xs text-foreground/90">
                  {it.fileName}
                </span>
                <StatusIcon status={it.status} active={idx === currentIndex} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

function StatusIcon({
  status,
  active,
}: {
  status: BatchItemStatus;
  active: boolean;
}) {
  if (status === "done")
    return <CheckCircle2 className="w-4 h-4 text-[var(--verdict-light)]" />;
  if (status === "error")
    return <AlertCircle className="w-4 h-4 text-destructive" />;
  if (status === "processing" || active)
    return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
  return <span className="w-2 h-2 rounded-full bg-foreground/20" />;
}

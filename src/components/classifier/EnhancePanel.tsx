import { motion } from "framer-motion";
import { Sparkles, Download, Loader2, AlertCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { enhanceImage } from "@/lib/api";
import type { Verdict } from "@/lib/types";

interface EnhancePanelProps {
  sourceFile: File;
  fileName: string;
  originalUrl: string;
  degradationClass: Verdict;
}

export function EnhancePanel({
  sourceFile,
  fileName,
  originalUrl,
  degradationClass,
}: EnhancePanelProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sliderPos, setSliderPos] = useState(50); // %
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (enhancedUrl) URL.revokeObjectURL(enhancedUrl);
    };
  }, [enhancedUrl]);

  const handleEnhance = async () => {
    setStatus("loading");
    setError(null);
    try {
      const blob = await enhanceImage(sourceFile, degradationClass);
      const url = URL.createObjectURL(blob);
      setEnhancedUrl(url);
      setStatus("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menjernihkan foto.");
      setStatus("error");
    }
  };

  const handleDownload = () => {
    if (!enhancedUrl) return;
    const a = document.createElement("a");
    a.href = enhancedUrl;
    const base = fileName.replace(/\.[^.]+$/, "");
    a.download = `${base}_enhanced.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const updateSliderFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    setSliderPos((x / rect.width) * 100);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="rounded-2xl glass-strong p-5 sm:p-6"
    >
      {status === "idle" && (
        <button
          type="button"
          onClick={handleEnhance}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99]"
        >
          Jernihkan Foto
        </button>
      )}

      {status === "loading" && (
        <div className="flex items-center justify-center gap-3 rounded-xl glass border border-border px-5 py-4 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Memproses penjernihan…
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-destructive">Gagal</p>
              <p className="text-xs text-muted-foreground mt-1">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleEnhance}
            className="mt-3 text-xs font-semibold text-primary hover:underline"
          >
            Coba lagi
          </button>
        </div>
      )}

      {status === "done" && enhancedUrl && (
        <div className="space-y-3">
          <div
            ref={containerRef}
            className="relative w-full overflow-hidden rounded-xl bg-background/40 border border-border select-none"
            style={{ aspectRatio: "4 / 3" }}
            onMouseDown={(e) => {
              draggingRef.current = true;
              updateSliderFromClientX(e.clientX);
            }}
            onMouseMove={(e) => {
              if (draggingRef.current) updateSliderFromClientX(e.clientX);
            }}
            onMouseUp={() => (draggingRef.current = false)}
            onMouseLeave={() => (draggingRef.current = false)}
            onTouchStart={(e) => {
              draggingRef.current = true;
              updateSliderFromClientX(e.touches[0].clientX);
            }}
            onTouchMove={(e) => {
              if (draggingRef.current)
                updateSliderFromClientX(e.touches[0].clientX);
            }}
            onTouchEnd={() => (draggingRef.current = false)}
          >
            {/* Enhanced (full) */}
            <img
              src={enhancedUrl}
              alt="Hasil penjernihan"
              className="absolute inset-0 w-full h-full object-contain"
              draggable={false}
            />
            {/* Original clipped */}
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${sliderPos}%` }}
            >
              <img
                src={originalUrl}
                alt="Original"
                className="absolute inset-0 h-full object-contain"
                style={{ width: `${(100 / sliderPos) * 100}%`, maxWidth: "none" }}
                draggable={false}
              />
            </div>
            {/* Divider */}
            <div
              className="absolute top-0 bottom-0 w-px bg-primary shadow-glow pointer-events-none"
              style={{ left: `${sliderPos}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px] font-bold shadow-glow"
              style={{
                left: `calc(${sliderPos}% - 16px)`,
                cursor: "ew-resize",
              }}
            >
              ⇄
            </div>
            {/* Labels */}
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-background/70 backdrop-blur text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Asli
            </span>
            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-primary/90 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
              Jernih
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              <Download className="w-4 h-4" />
              Unduh Foto Jernih
            </button>
            <button
              type="button"
              onClick={handleEnhance}
              className="inline-flex items-center justify-center gap-2 rounded-xl glass border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent/40"
            >
              Proses ulang
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

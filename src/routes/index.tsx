import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { ClassReference, Dropzone, HeroIntro } from "@/components/classifier/Dropzone";
import {
  type BatchItem,
  ProcessingView,
} from "@/components/classifier/ProcessingView";
import {
  ResultDashboard,
  type ResultItem,
} from "@/components/classifier/ResultDashboard";
import { AppHeader } from "@/components/classifier/AppHeader";
import { Ripple } from "@/components/ui/ripple";
import { classifyImage } from "@/lib/api";
import { addHistoryEntry, makeThumbnail } from "@/lib/history";

export const Route = createFileRoute("/")({
  component: Index,
});

type Status = "idle" | "processing" | "result" | "fatal-error";

function Index() {
  const [status, setStatus] = useState<Status>("idle");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(-1);
  const [fatalErrorMsg, setFatalErrorMsg] = useState<string | null>(null);
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    };
  }, []);

  const reset = () => {
    for (const url of objectUrlsRef.current) URL.revokeObjectURL(url);
    objectUrlsRef.current = [];
    setItems([]);
    setResults([]);
    setCurrentIdx(-1);
    setFatalErrorMsg(null);
    setStatus("idle");
  };

  const handleFiles = async (files: File[]) => {
    // build batch items + preview URLs
    const newUrls: string[] = [];
    const batch: BatchItem[] = files.map((f, idx) => {
      const url = URL.createObjectURL(f);
      newUrls.push(url);
      return {
        id: `${Date.now()}-${idx}-${f.name}`,
        fileName: f.name,
        previewUrl: url,
        status: "pending",
      };
    });
    objectUrlsRef.current = [...objectUrlsRef.current, ...newUrls];

    setItems(batch);
    setResults([]);
    setStatus("processing");
    setCurrentIdx(0);

    const minDelay = (ms: number) => new Promise((r) => setTimeout(r, ms));

    const finalResults: ResultItem[] = [];
    let connectivityFailed = false;

    for (let i = 0; i < files.length; i++) {
      setCurrentIdx(i);
      setItems((prev) =>
        prev.map((it, idx) => idx === i ? { ...it, status: "processing" } : it)
      );

      const file = files[i];
      const item = batch[i];

      try {
        // Min delay so the user can read at least a couple of pipeline labels.
        const minWait = i === 0 ? 2200 : 800;
        const [data] = await Promise.all([
          classifyImage(file),
          minDelay(minWait),
        ]);

        setItems((prev) =>
          prev.map((it, idx) => (idx === i ? { ...it, status: "done" } : it))
        );

        finalResults.push({
          id: item.id,
          fileName: item.fileName,
          previewUrl: item.previewUrl,
          file,
          status: "done",
          result: data,
        });

        // Persist to history (best-effort)
        try {
          const thumb = await makeThumbnail(file);
          addHistoryEntry({
            id: item.id,
            fileName: item.fileName,
            thumbnail: thumb,
            verdict: data.class,
            features: data.features,
            createdAt: Date.now(),
          });
        } catch {
          // ignore thumbnail/storage errors
        }
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : "Terjadi kesalahan tak terduga.";

        setItems((prev) =>
          prev.map((it, idx) =>
            idx === i ? { ...it, status: "error", error: message } : it
          )
        );

        finalResults.push({
          id: item.id,
          fileName: item.fileName,
          previewUrl: item.previewUrl,
          status: "error",
          error: message,
        });

        if (message.toLowerCase().includes("tidak dapat terhubung")) {
          connectivityFailed = true;
          // No point retrying remaining files — mark them as errored too.
          for (let j = i + 1; j < files.length; j++) {
            const skipItem = batch[j];
            setItems((prev) =>
              prev.map((it, idx) =>
                idx === j ? { ...it, status: "error", error: message } : it
              )
            );
            finalResults.push({
              id: skipItem.id,
              fileName: skipItem.fileName,
              previewUrl: skipItem.previewUrl,
              status: "error",
              error: message,
            });
          }
          break;
        } else {
          toast.error(`Gagal menganalisis "${item.fileName}"`, {
            description: message,
          });
        }
      }
    }

    // small breath before transitioning UI
    await minDelay(300);

    const successes = finalResults.filter((r) => r.status === "done").length;

    if (successes === 0) {
      if (connectivityFailed) {
        setFatalErrorMsg(
          "Tidak dapat terhubung ke server AI. Pastikan backend berjalan dan coba lagi.",
        );
        setStatus("fatal-error");
      } else {
        setFatalErrorMsg(
          "Tidak ada foto yang berhasil dianalisis. Periksa berkas Anda dan coba lagi.",
        );
        setStatus("fatal-error");
      }
      return;
    }

    setResults(finalResults);
    setStatus("result");

    if (successes === finalResults.length) {
      toast.success(
        successes === 1
          ? "Foto berhasil dianalisis."
          : `${successes} foto berhasil dianalisis.`,
      );
    } else {
      toast.warning(
        `${successes} dari ${finalResults.length} foto berhasil dianalisis.`,
      );
    }
  };

  return (
    <main className="relative min-h-screen w-full flex flex-col overflow-hidden">
      <Ripple className="z-0" />
      <AppHeader />

      <section className="relative z-10 flex-1 flex flex-col py-6 sm:py-10">
        <div className="w-full max-w-7xl mx-auto px-6">
          <HeroIntro />

          <AnimatePresence mode="wait">
            {status === "idle" && (
              <motion.div
                key="dz"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35 }}
              >
                <Dropzone onFiles={handleFiles} />
              </motion.div>
            )}

            {status === "fatal-error" && (
              <motion.div
                key="err"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full max-w-lg mx-auto text-center"
              >
                <div className="rounded-2xl glass-strong p-8 shadow-elegant">
                  <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center bg-destructive/15 border border-destructive/30 mb-5">
                    <AlertTriangle className="w-7 h-7 text-destructive" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground">
                    Analisis Gagal
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {fatalErrorMsg}
                  </p>
                  <button
                    type="button"
                    onClick={reset}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.03]"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Coba Lagi
                  </button>
                </div>
              </motion.div>
            )}

            {status === "result" && results.length > 0 && (
              <motion.div
                key="res"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.4 }}
              >
                <ResultDashboard items={results} onReset={reset} />
              </motion.div>
            )}
          </AnimatePresence>

          <ClassReference />
        </div>
      </section>

      <AnimatePresence>
        {status === "processing" && items.length > 0 && (
          <ProcessingView
            key="proc"
            items={items}
            currentIndex={currentIdx}
            backgroundUrl={items[Math.max(0, currentIdx)]?.previewUrl}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

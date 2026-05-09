import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud, FilePlus, ChevronDown, Image as ImageIcon, ArrowRight, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  ACCEPTED_EXTENSIONS,
  MAX_BATCH_FILES,
  partitionFiles,
} from "@/lib/types";

interface DropzoneProps {
  onFiles: (files: File[]) => void;
}

export function HeroIntro() {
  return (
    <div className="grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center pt-8 pb-10">
      <div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.05]">
          Photo Damage{" "}
          <span className="text-primary">Classifier</span>
        </h1>
        <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl leading-relaxed">
          Klasifikasi otomatis tingkat kerusakan foto lama (Ringan, Sedang,
          Berat) menggunakan ekstraksi fitur tekstur GLCM dan algoritma SVM.
          Unggah hingga {MAX_BATCH_FILES} foto sekaligus.
        </p>
      </div>

      <div className="relative flex items-center justify-center gap-4 sm:gap-6">
        <div
          aria-hidden
          className="absolute inset-0 -z-0"
          style={{
            backgroundImage:
              "radial-gradient(circle, oklch(0.62 0.21 25 / 0.08) 0%, transparent 60%)",
          }}
        />
        <DiagramTile label="FOTO" Icon={ImageIcon} />
        <div className="flex flex-col items-center gap-1">
          <span className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-glow">
            <ArrowRight className="w-5 h-5 text-primary-foreground" />
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            AI
          </span>
        </div>
        <DiagramTile label="KELAS" Icon={Sparkles} />
      </div>
    </div>
  );
}

export function ClassReference() {
  return (
    <section className="mt-14 mb-12">
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-muted-foreground mb-5">
        <span className="w-4 h-4 rounded-full bg-primary inline-flex items-center justify-center text-[10px] font-bold text-primary-foreground">
          i
        </span>
        Kelas Klasifikasi
      </p>
      <div className="grid sm:grid-cols-3 gap-3">
        <ClassRefCard
          label="RINGAN"
          color="var(--verdict-light)"
          description="Degradasi minimal: kontras dan tekstur foto masih utuh, sedikit noise atau bercak halus."
        />
        <ClassRefCard
          label="SEDANG"
          color="var(--verdict-medium)"
          description="Bercak coklat (foxing), garis sobekan, atau blur lokal mulai terlihat tapi obyek utama masih terbaca jelas."
        />
        <ClassRefCard
          label="BERAT"
          color="var(--verdict-heavy)"
          description="Goresan tajam, blur menyeluruh, fading parah, atau hilangnya detail tekstur secara signifikan."
        />
      </div>
    </section>
  );
}

export function Dropzone({ onFiles }: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    (rawList: FileList | File[] | null | undefined) => {
      if (!rawList) return;
      const all = Array.from(rawList);
      if (all.length === 0) return;

      let limited = all;
      if (all.length > MAX_BATCH_FILES) {
        limited = all.slice(0, MAX_BATCH_FILES);
        toast.warning(
          `Maksimal ${MAX_BATCH_FILES} foto per unggahan. ${all.length - MAX_BATCH_FILES} foto sisanya diabaikan.`,
        );
      }

      const { valid, invalid } = partitionFiles(limited);

      for (const err of invalid) {
        toast.error(`"${err.file.name}" tidak dapat diunggah`, {
          description: err.reason,
        });
      }

      if (valid.length === 0) return;
      onFiles(valid);
    },
    [onFiles],
  );

  return (
    <motion.label
      htmlFor="file-input"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      animate={{ scale: dragOver ? 1.005 : 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 22 }}
      className={`relative block cursor-pointer rounded-2xl bg-card/10 backdrop-blur-2xl overflow-hidden border transition-all duration-300 ${
        dragOver
          ? "border-primary shadow-glow"
          : "border-border hover:border-border/80"
      }`}
    >
      <div className="relative px-8 py-14 sm:py-16 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mb-6">
          <UploadCloud className="w-8 h-8 text-primary" />
        </div>

        <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
          Pilih foto Anda untuk memulai
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          atau lepaskan foto di sini.
        </p>

        <div className="mt-7 inline-flex items-stretch rounded-md overflow-hidden shadow-glow">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              inputRef.current?.click();
            }}
            className="inline-flex items-center gap-2 bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 active:brightness-95 transition"
          >
            <FilePlus className="w-4 h-4" />
            Select File
          </button>
          <span className="w-px bg-black/20" />
          <button
            type="button"
            aria-label="Opsi lain"
            onClick={(e) => {
              e.preventDefault();
              inputRef.current?.click();
            }}
            className="inline-flex items-center justify-center bg-primary px-2 text-primary-foreground hover:brightness-110 active:brightness-95 transition"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <p className="mt-5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {ACCEPTED_EXTENSIONS.map((e) => e.toUpperCase()).join(" · ")} · maks 10 MB / foto
        </p>

        <input
          id="file-input"
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
    </motion.label>
  );
}

function DiagramTile({
  label,
  Icon,
}: {
  label: string;
  Icon: typeof ImageIcon;
}) {
  return (
    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-xl bg-card border border-border flex flex-col items-center justify-center gap-2 shadow-soft">
      <Icon className="w-8 h-8 text-muted-foreground" />
      <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function ClassRefCard({
  label,
  color,
  description,
}: {
  label: string;
  color: string;
  description: string;
}) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 flex gap-3">
      <div
        className="w-10 h-10 rounded-md shrink-0 flex items-center justify-center"
        style={{
          background: `color-mix(in oklab, ${color} 15%, transparent)`,
          border: `1px solid color-mix(in oklab, ${color} 40%, transparent)`,
        }}
      >
        <ImageIcon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p
          className="text-xs font-bold uppercase tracking-[0.2em]"
          style={{ color }}
        >
          {label}
        </p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  );
}

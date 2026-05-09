import { motion } from "framer-motion";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import type { Verdict } from "@/lib/types";

interface VerdictBadgeProps {
  verdict: Verdict;
}

const CONFIG: Record<
  Verdict,
  {
    label: string;
    sub: string;
    color: string;
    glow: string;
    icon: typeof ShieldCheck;
  }
> = {
  Ringan: {
    label: "Ringan",
    sub: "Degradasi minimal terdeteksi",
    color: "var(--verdict-light)",
    glow: "var(--verdict-light-glow)",
    icon: ShieldCheck,
  },
  Sedang: {
    label: "Sedang",
    sub: "Degradasi tingkat menengah",
    color: "var(--verdict-medium)",
    glow: "var(--verdict-medium-glow)",
    icon: ShieldAlert,
  },
  Berat: {
    label: "Berat",
    sub: "Degradasi parah terdeteksi",
    color: "var(--verdict-heavy)",
    glow: "var(--verdict-heavy-glow)",
    icon: ShieldX,
  },
};

export function VerdictBadge({ verdict }: VerdictBadgeProps) {
  const cfg = CONFIG[verdict];
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{
        type: "spring",
        stiffness: 220,
        damping: 18,
        delay: 0.1,
      }}
      className="relative rounded-2xl glass-strong p-6 sm:p-7 overflow-hidden "

    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          background: `radial-gradient(circle at 0% 0%, ${cfg.glow}, transparent 60%)`,
        }}
      />
      <div className="relative flex items-center gap-5">
        <div
          className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: `color-mix(in oklab, ${cfg.color} 18%, transparent)`,
            border: `1px solid color-mix(in oklab, ${cfg.color} 40%, transparent)`,
          }}
        >
          <Icon className="w-8 h-4" style={{ color: cfg.color }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
            Tingkat Degradasi
          </p>
          <p
            className="text-2xl sm:text-3xl font-bold leading-tight mt-1"
            style={{
              color: cfg.color,
              textShadow: `0 0 30px ${cfg.glow}`,
            }}
          >
            {cfg.label}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{cfg.sub}</p>
        </div>
      </div>
    </motion.div>
  );
}

import { motion } from "framer-motion";
import { Info, type LucideIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FeatureCardProps {
  label: string;
  englishLabel: string;
  value: number;
  icon: LucideIcon;
  short: string;
  description: string;
  delay?: number;
}

export function FeatureCard({
  label,
  englishLabel,
  value,
  icon: Icon,
  short,
  description,
  delay = 0,
}: FeatureCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl glass p-5 "
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {englishLabel}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-sm font-medium text-foreground/90">{label}</p>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Penjelasan ${label}`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Info className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent
                  side="top"
                  align="start"
                  className="max-w-xs glass-strong border-border text-foreground"
                >
                  <p className="text-xs leading-relaxed">{description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/20 shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
      </div>
      <p
        className="mt-4 text-3xl font-semibold tracking-tight text-foreground tabular-nums"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value.toFixed(4)}
      </p>
      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
        {short}
      </p>
    </motion.div>
  );
}

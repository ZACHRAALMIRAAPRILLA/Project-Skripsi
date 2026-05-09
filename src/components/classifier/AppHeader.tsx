import { Link, useLocation } from "@tanstack/react-router";
import { History, Home, ImageIcon, Moon, Play, Sun } from "lucide-react";
import { Dock, DockIcon } from "@/components/ui/dock";
import { useTheme } from "@/components/theme-provider";

export function AppHeader() {
  const location = useLocation();
  const isHistory = location.pathname.startsWith("/riwayat");
  const { theme, toggle } = useTheme();

  const itemBase =
    "flex h-full w-full items-center justify-center rounded-full transition-colors";
  const active = "bg-primary/15 text-primary";
  const inactive = "text-muted-foreground hover:text-foreground";

  return (
    <header className="relative z-20 px-6 sm:px-10 py-4">
      <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5 ml-6">
          <span className="text-base sm:text-lg font-bold tracking-tight">
            photo<span className="text-primary">classify</span>
          </span>
        </Link>

        <Dock
          direction="middle"
          className="!mt-0 border-border bg-background/40"
          iconSize={42}
          iconMagnification={62}
          iconDistance={120}
        >
          <DockIcon>
            <Link
              to="/"
              aria-label="Beranda"
              className={`${itemBase} ${!isHistory ? active : inactive}`}
            >
              <Home className="w-5 h-5" />
            </Link>
          </DockIcon>
          <DockIcon>
            <Link
              to="/riwayat"
              aria-label="Riwayat"
              className={`${itemBase} ${isHistory ? active : inactive}`}
            >
              <History className="w-5 h-5" />
            </Link>
          </DockIcon>
   
          <div className="mx-1 h-8 w-px bg-border" />
          <DockIcon>
            <button
              type="button"
              onClick={toggle}
              aria-label="Toggle theme"
              className={`${itemBase} ${inactive}`}
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          </DockIcon>
        </Dock>
      </div>
    </header>
  );
}

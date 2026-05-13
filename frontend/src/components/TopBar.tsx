"use client";

import { useState, useEffect } from "react";
import { Sun, Moon, Zap, Loader2 } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { runGlobalAudit } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export function TopBar() {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState(new Date());
  const [auditing, setAuditing] = useState(false);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAudit = async () => {
    setAuditing(true);
    try {
      const result = await runGlobalAudit();
      toast({
        title: "Global Audit Complete",
        description: `${result.verified} verified, ${result.tampered} tampered epoch(s).`,
      });
    } finally {
      setAuditing(false);
    }
  };

  return (
    <header className="flex items-center justify-between border-b bg-card px-6 py-3">
      <div className="flex items-center gap-4">
        <span className="font-mono text-sm text-muted-foreground">
          {mounted ? time.toLocaleString() : ""}
        </span>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-verified opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-verified" />
          </span>
          <span className="text-sm text-muted-foreground">Agent Status: <span className="text-verified font-medium">Active</span></span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAudit}
          disabled={auditing}
          className="border-warning text-warning hover:bg-warning/10"
        >
          {auditing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
          Run Global Audit
        </Button>

        <button
          onClick={toggle}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  );
}

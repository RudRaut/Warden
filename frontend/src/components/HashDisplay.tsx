import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface HashDisplayProps {
  hash: string;
  truncate?: number;
  className?: string;
}

export function HashDisplay({ hash, truncate = 16, className }: HashDisplayProps) {
  const [copied, setCopied] = useState(false);
  const display = hash.length > truncate ? hash.slice(0, truncate) + "..." : hash;

  const copy = async () => {
    await navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={copy} className={cn("inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground transition-colors", className)}>
          <span>{display}</span>
          {copied ? <Check className="h-3 w-3 text-verified" /> : <Copy className="h-3 w-3 opacity-50" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-sm">
        <p className="font-mono text-xs break-all">{hash}</p>
        <p className="text-xs text-muted-foreground mt-1">Click to copy</p>
      </TooltipContent>
    </Tooltip>
  );
}

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FilePathDisplayProps {
  path: string;
  className?: string;
}

export function FilePathDisplay({ path, className }: FilePathDisplayProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(path);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button onClick={copy} className={cn("font-mono text-xs text-foreground hover:text-primary transition-colors text-left truncate max-w-[250px]", className)}>
          {path}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="font-mono text-xs">{path}</p>
        <p className="text-xs text-muted-foreground">{copied ? "Copied!" : "Click to copy"}</p>
      </TooltipContent>
    </Tooltip>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Database, RefreshCw, Info, Loader2 } from "lucide-react";
import { fetchEpochs, verifyEpoch } from "@/lib/api";
import { EventTable } from "@/components/EventTable";
import { StatusBadge } from "@/components/StatusBadge";
import { HashDisplay } from "@/components/HashDisplay";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Epoch } from "@/lib/mockData";

export default function EpochAuditPage() {
  const [epochs, setEpochs] = useState<Epoch[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [verifying, setVerifying] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchEpochs().then(setEpochs);
  }, []);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleVerify = async (epochId: string) => {
    setVerifying(epochId);
    try {
      const result = await verifyEpoch(epochId);
      setEpochs((prev) =>
        prev.map(ep => ep.id === epochId ? { ...ep, status: result.status } : ep)
      );
    } finally {
      setVerifying(null);
    }
  };

  const formatTime = (ts: string) => {
    if (!mounted || !ts) return "";
    return new Date(ts.replace(" ", "T")).toLocaleTimeString();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Epoch Audit View</h1>

      {/* Epoch list */}
      <div className="space-y-3">
        {epochs.map((epoch) => {
          const isOpen = expanded.has(epoch.id);
          const isTampered = epoch.status === "TAMPERED";

          return (
            <div
              key={epoch.id}
              className={cn(
                "rounded-lg border bg-card overflow-hidden transition-all",
                isTampered && "border-tampered tampered-pulse",
                epoch.status === "VERIFIED" && "border-l-4 border-l-verified",
                epoch.status === "PENDING" && "border-l-4 border-l-warning"
              )}
            >
              {/* Header */}
              <button
                onClick={() => toggle(epoch.id)}
                className="flex items-center gap-4 w-full px-4 py-3 text-left hover:bg-muted/30 transition-colors"
              >
                {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                <span className="font-mono text-sm font-medium text-foreground">{epoch.id}</span>
                <span className="text-xs text-muted-foreground">
                  {formatTime(epoch.timeStart)} → {formatTime(epoch.timeEnd)}
                </span>
                <span className="text-xs text-muted-foreground">{epoch.eventCount} events</span>
                <div className="ml-auto flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
                    <Database className="h-3 w-3" />
                    <span>Fabric Ledger</span>
                  </div>
                  <StatusBadge type="status" value={epoch.status} />
                </div>
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="border-t px-4 py-3 space-y-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-xs text-muted-foreground">
                      Merkle Root: <HashDisplay hash={epoch.merkleRoot} truncate={32} />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerify(epoch.id)}
                      disabled={verifying === epoch.id}
                      className="text-xs"
                    >
                      {verifying === epoch.id ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                      Re-verify Epoch
                    </Button>
                  </div>
                  <EventTable events={epoch.events} compact />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

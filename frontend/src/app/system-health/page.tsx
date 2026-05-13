"use client";

import { useEffect, useState } from "react";
import { Cpu, Database, HardDrive, Shield, Link, AlertTriangle } from "lucide-react";
import { fetchHealth } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { HealthService } from "@/lib/mockData";

const iconMap: Record<string, typeof Cpu> = { Cpu, Database, HardDrive, Shield, Link };

const statusColors = {
  healthy: "border-l-verified bg-verified/5",
  degraded: "border-l-warning bg-warning/5",
  down: "border-l-tampered bg-tampered/5",
  not_configured: "border-l-muted-foreground bg-muted/50",
};

const statusDot = {
  healthy: "bg-verified",
  degraded: "bg-warning",
  down: "bg-tampered",
  not_configured: "bg-muted-foreground",
};

const statusLabel = {
  healthy: "Healthy",
  degraded: "Degraded",
  down: "Down",
  not_configured: "Not Configured",
};

export default function SystemHealthPage() {
  const [services, setServices] = useState<HealthService[]>([]);

  useEffect(() => {
    fetchHealth().then(setServices);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">System Health</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {services.map((svc) => {
          const Icon = iconMap[svc.icon] || Cpu;
          return (
            <div key={svc.name} className={cn("rounded-lg border border-l-4 bg-card p-4 space-y-3", statusColors[svc.status])}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <h3 className="font-medium text-sm text-foreground">{svc.name}</h3>
                    <p className="text-xs text-muted-foreground">{svc.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", statusDot[svc.status])} />
                  <span className="text-xs font-medium text-muted-foreground">{statusLabel[svc.status]}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                {Object.entries(svc.metrics).map(([key, val]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-mono text-foreground">
                      {typeof val === "string" && val.includes("T") ? new Date(val).toLocaleTimeString() : String(val)}
                    </span>
                  </div>
                ))}
              </div>

              {svc.status === "not_configured" && (
                <div className="flex items-center gap-2 rounded bg-warning/10 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                  <span className="text-xs text-warning">Using CouchDB Anchor DB as substitute</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

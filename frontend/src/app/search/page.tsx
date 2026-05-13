"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { EventTable } from "@/components/EventTable";
import { searchEvents } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import type { FileEvent, ActionType, IntegrityStatus } from "@/lib/mockData";

const actionTypes: ActionType[] = ["CREATE", "MODIFY", "DELETE", "MOVE"];
const statusOptions: (IntegrityStatus | "ALL")[] = ["ALL", "VERIFIED", "TAMPERED", "PENDING"];
const quickPaths = ["/etc/", "/bin/", "/usr/", "/root/"];

export default function SearchPage() {
  const [filePath, setFilePath] = useState("");
  const [selectedActions, setSelectedActions] = useState<Set<ActionType>>(new Set());
  const [statusFilter, setStatusFilter] = useState<IntegrityStatus | "ALL">("ALL");
  const [results, setResults] = useState<FileEvent[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleAction = (a: ActionType) => {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      next.has(a) ? next.delete(a) : next.add(a);
      return next;
    });
  };

  const handleSearch = async () => {
    setLoading(true);
    const data = await searchEvents({
      filePath,
      actions: selectedActions.size > 0 ? Array.from(selectedActions) : undefined,
      status: statusFilter,
    });
    setResults(data);
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Search & Filter</h1>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        {/* File path */}
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">File Path (partial match)</label>
          <Input
            placeholder="/etc/passwd"
            value={filePath}
            onChange={(e) => setFilePath(e.target.value)}
            className="font-mono text-sm"
          />
        </div>

        {/* Quick filters */}
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">High Risk Directories</label>
          <div className="flex gap-2 flex-wrap">
            {quickPaths.map((p) => (
              <Button key={p} variant="outline" size="sm" onClick={() => setFilePath(p)} className="font-mono text-xs">
                {p}
              </Button>
            ))}
          </div>
        </div>

        {/* Action checkboxes */}
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Action Type</label>
          <div className="flex gap-4">
            {actionTypes.map((a) => (
              <label key={a} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedActions.has(a)}
                  onCheckedChange={() => toggleAction(a)}
                />
                {a}
              </label>
            ))}
          </div>
        </div>

        {/* Status */}
        <div>
          <label className="text-sm text-muted-foreground mb-2 block">Status</label>
          <div className="flex gap-2">
            {statusOptions.map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(s)}
                className="text-xs"
              >
                {s}
              </Button>
            ))}
          </div>
        </div>

        <Button onClick={handleSearch} disabled={loading}>
          <Search className="h-4 w-4 mr-2" />
          {loading ? "Searching..." : "Search Events"}
        </Button>
      </div>

      {results !== null && (
        <div>
          <p className="text-sm text-muted-foreground mb-2">{results.length} result(s) found</p>
          <EventTable events={results} />
        </div>
      )}
    </div>
  );
}

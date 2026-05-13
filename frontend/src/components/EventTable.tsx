"use client";

import { useState, useEffect } from "react";
import type { FileEvent } from "@/lib/mockData";
import { StatusBadge } from "./StatusBadge";
import { HashDisplay } from "./HashDisplay";
import { FilePathDisplay } from "./FilePathDisplay";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface EventTableProps {
  events: FileEvent[];
  compact?: boolean;
}

export function EventTable({ events, compact }: EventTableProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatTime = (ts: string | undefined) => {
    if (!mounted || !ts) return "---";
    const safeTs = typeof ts === "string" ? ts.replace(" ", "T") : String(ts);
    return new Date(safeTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };


  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs">Timestamp</TableHead>
            <TableHead className="text-xs">Action</TableHead>
            <TableHead className="text-xs">File Path</TableHead>
            <TableHead className="text-xs">SHA-256</TableHead>
            {!compact && <TableHead className="text-xs">Epoch</TableHead>}
            <TableHead className="text-xs">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((evt) => (
            <TableRow key={evt.id} className="hover:bg-muted/30 transition-colors">
              <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                {formatTime(evt.timestamp)}
              </TableCell>
              <TableCell><StatusBadge type="action" value={evt.action} /></TableCell>
              <TableCell><FilePathDisplay path={evt.filePath} /></TableCell>
              <TableCell><HashDisplay hash={evt.sha256} /></TableCell>
              {!compact && <TableCell className="font-mono text-xs text-muted-foreground">{evt.epochId}</TableCell>}
              <TableCell><StatusBadge type="status" value={evt.status} /></TableCell>
            </TableRow>
          ))}
          {events.length === 0 && (
            <TableRow>
              <TableCell colSpan={compact ? 5 : 6} className="text-center text-muted-foreground py-8">
                No events found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

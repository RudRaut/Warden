"use client";

import { useEffect, useState, useCallback } from "react";
import { Pause, Play } from "lucide-react";
import { EventTable } from "@/components/EventTable";
import { fetchEvents } from "@/lib/api";
import { Button } from "@/components/ui/button";
import type { FileEvent, ActionType } from "@/lib/mockData";

const actionTypes: ActionType[] = ["CREATE", "MODIFY", "DELETE", "MOVE"];

export default function LiveFeedPage() {
  const [events, setEvents] = useState<FileEvent[]>([]);
  const [paused, setPaused] = useState(false);
  const [filters, setFilters] = useState<Set<ActionType>>(new Set());

  const load = useCallback(async () => {
    const data = await fetchEvents();
    setEvents(data);
  }, []);

  useEffect(() => {
    load();
    if (paused) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [paused, load]);

  const toggleFilter = (action: ActionType) => {
    setFilters((prev) => {
      const next = new Set(prev);
      next.has(action) ? next.delete(action) : next.add(action);
      return next;
    });
  };

  const filtered = filters.size === 0 ? events : events.filter((e) => filters.has(e.action));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Live Event Feed</h1>
        <Button variant="outline" size="sm" onClick={() => setPaused(!paused)}>
          {paused ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
          {paused ? "Resume" : "Pause"}
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Filter:</span>
        {actionTypes.map((a) => (
          <Button
            key={a}
            variant={filters.has(a) ? "default" : "outline"}
            size="sm"
            onClick={() => toggleFilter(a)}
            className="text-xs"
          >
            {a}
          </Button>
        ))}
      </div>

      {!paused && (
        <p className="text-xs text-muted-foreground">Auto-refreshing every 5 seconds…</p>
      )}

      <EventTable events={filtered} />
    </div>
  );
}

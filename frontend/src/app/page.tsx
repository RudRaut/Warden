"use client";

import { useEffect, useState } from "react";
import { BarChart3, CheckCircle, AlertTriangle, Clock, Layers } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { StatCard } from "@/components/StatCard";
import { EventTable } from "@/components/EventTable";
import { fetchDashboardStats, fetchChartData, fetchEvents } from "@/lib/api";
import type { FileEvent } from "@/lib/mockData";

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [chart, setChart] = useState<any[]>([]);
  const [events, setEvents] = useState<FileEvent[]>([]);

  useEffect(() => {
    fetchDashboardStats().then(setStats);
    fetchChartData().then(setChart);
    fetchEvents().then((e) => setEvents(e.slice(0, 10)));
  }, []);

  if (!stats) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard icon={<BarChart3 className="h-5 w-5" />} label="Total Events Today" value={stats.totalEventsToday} variant="blue" />
        <StatCard icon={<CheckCircle className="h-5 w-5" />} label="Verified Epochs" value={stats.verifiedEpochs} variant="green" />
        <StatCard icon={<AlertTriangle className="h-5 w-5" />} label="Tampered Epochs" value={stats.tamperedEpochs} variant="red" />
        <StatCard icon={<Clock className="h-5 w-5" />} label="Last Anchor" value={new Date(stats.lastAnchorTimestamp).toLocaleTimeString()} variant="grey" />
        <StatCard icon={<Layers className="h-5 w-5" />} label="Queue Depth" value={stats.queueDepth} variant="amber" />
      </div>

      {/* Chart */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">File Events — Last 24 Hours</h2>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chart}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                fontSize: 12,
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="CREATE" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="MODIFY" stroke="hsl(38, 92%, 50%)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="DELETE" stroke="hsl(0, 84%, 60%)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Recent Activity</h2>
        <EventTable events={events} />
      </div>
    </div>
  );
}

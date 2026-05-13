import type { FileEvent, Epoch, HealthService, ActionType, IntegrityStatus } from "./mockData";

// ─── API Base URL ───────────────────────────────────────────
// Points to the Warden Node.js backend
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText}`);
  }
  return res.json();
}

// Normalize C++ sensor action names (past tense) → frontend ActionType (present tense)
function normalizeAction(action: string): ActionType {
  const map: Record<string, ActionType> = {
    CREATED: "CREATE",
    MODIFIED: "MODIFY",
    DELETED: "DELETE",
    CREATE: "CREATE",
    MODIFY: "MODIFY",
    DELETE: "DELETE",
  };
  return map[action] || (action as ActionType);
}

// ─── Event Logs ─────────────────────────────────────────────
export async function fetchEvents(): Promise<FileEvent[]> {
  const logs = await apiFetch<any[]>("/logs?limit=200");
  // Map CouchDB schema → frontend FileEvent shape
  return logs.map((doc) => ({
    id: doc._id || doc.event_id,
    timestamp: doc.timestamp,
    filePath: doc.file_path,
    action: normalizeAction(doc.action),
    sha256: doc.file_hash,
    epochId: doc.batch_id,
    status: (doc.status === "COMMITTED" ? "VERIFIED" : doc.status) as IntegrityStatus,
  }));
}

// ─── Epochs ─────────────────────────────────────────────────
export async function fetchEpochs(): Promise<Epoch[]> {
  const [epochs, audit] = await Promise.all([
    apiFetch<any[]>("/epochs"),
    apiFetch<{ epochs: { id: string; status: string }[] }>("/audit").catch(() => null)
  ]);

  const statusMap = new Map<string, IntegrityStatus>();
  if (audit && audit.epochs) {
    audit.epochs.forEach((e) => statusMap.set(e.id, e.status as IntegrityStatus));
  }

  // For each epoch, fetch its events to populate the nested array
  return Promise.all(
    epochs.map(async (ep) => {
      const events = await fetchEventsByEpoch(ep.id);
      const trueStatus = statusMap.get(ep.id) || (ep.status === "COMMITTED" ? "VERIFIED" : ep.status) as IntegrityStatus;
      
      const updatedEvents = events.map(e => ({ ...e, status: trueStatus }));

      return {
        id: ep.id,
        timeStart: ep.timeStart,
        timeEnd: ep.timeEnd,
        eventCount: ep.eventCount,
        merkleRoot: ep.merkleRoot,
        status: trueStatus,
        events: updatedEvents,
      };
    })
  );
}

async function fetchEventsByEpoch(epochId: string): Promise<FileEvent[]> {
  // Use dedicated endpoint to fetch events for a specific epoch
  const logs = await apiFetch<any[]>(`/logs/${encodeURIComponent(epochId)}`);
  return logs.map((doc) => ({
    id: doc._id || doc.event_id,
    timestamp: doc.timestamp,
    filePath: doc.file_path,
    action: normalizeAction(doc.action),
    sha256: doc.file_hash,
    epochId: doc.batch_id,
    status: (doc.status === "COMMITTED" ? "VERIFIED" : doc.status) as IntegrityStatus,
  }));
}

// ─── Verification ───────────────────────────────────────────
export async function verifyEpoch(epochId: string): Promise<{ status: IntegrityStatus }> {
  const result = await apiFetch<{ status: string }>(`/verify/${epochId}`);
  return { status: result.status as IntegrityStatus };
}

export async function runGlobalAudit(): Promise<{ verified: number; tampered: number }> {
  const result = await apiFetch<{ verified: number; tampered: number }>("/audit");
  return { verified: result.verified, tampered: result.tampered };
}

// ─── Health ─────────────────────────────────────────────────
export async function fetchHealth(): Promise<HealthService[]> {
  return apiFetch<HealthService[]>("/health");
}

// ─── Dashboard Stats ────────────────────────────────────────
export async function fetchDashboardStats() {
  return apiFetch<{
    totalEventsToday: number;
    verifiedEpochs: number;
    tamperedEpochs: number;
    pendingEpochs: number;
    lastAnchorTimestamp: string;
    queueDepth: number;
  }>("/stats");
}

// ─── Chart Data ─────────────────────────────────────────────
// The backend doesn't serve pre-shaped chart data yet.
// We derive it from events: group by hour, count actions.
export async function fetchChartData() {
  // Fetch more events so we cover 24 hours
  const logs = await apiFetch<any[]>("/logs?limit=5000");
  const events = logs.map((doc) => ({
    timestamp: doc.timestamp,
    action: normalizeAction(doc.action),
  }));

  const now = new Date();
  // Align "now" to the start of the current hour (e.g. 15:45 -> 15:00)
  now.setMinutes(0, 0, 0);

  const hoursMap: Record<string, { time: string; CREATE: number; MODIFY: number; DELETE: number }> = {};
  const orderedKeys: string[] = [];

  // Init 24 hour slots backwards
  for (let i = 23; i >= 0; i--) {
    const slotHour = new Date(now.getTime() - i * 3600000);
    const key = slotHour.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    hoursMap[key] = { time: key, CREATE: 0, MODIFY: 0, DELETE: 0 };
    orderedKeys.push(key);
  }

  const minTime = now.getTime() - 23 * 3600000;

  // Tally events
  for (const ev of events) {
    // Some formats like "2026-04-04 03:14:06" might need standard Date parsing
    const evTime = new Date(ev.timestamp.replace(" ", "T")); 
    if (evTime.getTime() >= minTime) {
      evTime.setMinutes(0, 0, 0); // truncate to hour
      const key = evTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      if (hoursMap[key]) {
        const action = ev.action as "CREATE" | "MODIFY" | "DELETE";
        if (action in hoursMap[key]) {
          hoursMap[key][action]++;
        }
      }
    }
  }

  return orderedKeys.map((k) => hoursMap[k]);
}

// ─── Search ─────────────────────────────────────────────────
export interface SearchFilters {
  dateFrom?: string;
  dateTo?: string;
  filePath?: string;
  actions?: ActionType[];
  status?: IntegrityStatus | "ALL";
}

export async function searchEvents(filters: SearchFilters): Promise<FileEvent[]> {
  const params = new URLSearchParams();
  if (filters.filePath) params.set("filePath", filters.filePath);
  if (filters.actions && filters.actions.length > 0) params.set("action", filters.actions[0]);
  if (filters.status && filters.status !== "ALL") params.set("status", filters.status);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);

  const logs = await apiFetch<any[]>(`/search?${params.toString()}`);
  return logs.map((doc) => ({
    id: doc._id || doc.event_id,
    timestamp: doc.timestamp,
    filePath: doc.file_path,
    action: normalizeAction(doc.action),
    sha256: doc.file_hash,
    epochId: doc.batch_id,
    status: (doc.status === "COMMITTED" ? "VERIFIED" : doc.status) as IntegrityStatus,
  }));
}

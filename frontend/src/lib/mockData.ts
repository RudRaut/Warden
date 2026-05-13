export type ActionType = "CREATE" | "MODIFY" | "DELETE" | "MOVE";
export type IntegrityStatus = "VERIFIED" | "TAMPERED" | "PENDING";

export interface FileEvent {
  id: string;
  timestamp: string;
  filePath: string;
  action: ActionType;
  sha256: string;
  epochId: string;
  status: IntegrityStatus;
}

export interface Epoch {
  id: string;
  timeStart: string;
  timeEnd: string;
  eventCount: number;
  merkleRoot: string;
  status: IntegrityStatus;
  events: FileEvent[];
}

export interface HealthService {
  name: string;
  description: string;
  status: "healthy" | "degraded" | "down" | "not_configured";
  icon: string;
  metrics: Record<string, string | number>;
}

const hashes = [
  "a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a",
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592",
  "cf80cd8aed482d5d1527d7dc72fceff84e6326592848447d2dc0b0e87dfc9a90",
  "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
  "3fdba35f04dc8c462986c992bcf875546257113072a909c162f7e470e581e278",
  "8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92",
  "5feceb66ffc86f38d952786c6d696c79c2dbc239dd4e91b46729d73a27fb57e9",
  "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
  "fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9",
  "7d793037a0760186574b0282f2f435e7",
  "c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2",
  "ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d",
  "4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce",
  "6b51d431df5d7f141cbececcf79edf3dd861c3b4069f0b11661a3eefacbba918",
  "3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d",
  "2e7d2c03a9507ae265ecf5b5356885a53393a2029d241394997265a1a25aefc6",
  "18ac3e7343f016890c510e93f935261169d9e3f565436429830faf0934f4f8e4",
];

const filePaths = [
  "/etc/passwd", "/etc/shadow", "/etc/hosts", "/etc/ssh/sshd_config",
  "/bin/bash", "/bin/ls", "/usr/bin/sudo", "/usr/sbin/sshd",
  "/var/log/syslog", "/var/log/auth.log", "/var/log/kern.log",
  "/home/user/.bashrc", "/home/user/.ssh/authorized_keys",
  "/root/.bashrc", "/root/.ssh/id_rsa",
  "/etc/crontab", "/etc/nginx/nginx.conf", "/etc/systemd/system/app.service",
  "/opt/app/config.yml", "/opt/app/bin/server",
];

const actions: ActionType[] = ["CREATE", "MODIFY", "DELETE", "MOVE"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const now = new Date();
const epochData: Epoch[] = [];
const allEvents: FileEvent[] = [];

for (let e = 0; e < 5; e++) {
  const epochStart = new Date(now.getTime() - (5 - e) * 60000);
  const epochEnd = new Date(epochStart.getTime() + 60000);
  const epochId = `EPOCH-${String(e + 1).padStart(4, "0")}`;
  const status: IntegrityStatus = e === 3 ? "TAMPERED" : e === 4 ? "PENDING" : "VERIFIED";
  const eventCount = 4 + Math.floor(Math.random() * 4);
  const events: FileEvent[] = [];

  for (let i = 0; i < eventCount; i++) {
    const evt: FileEvent = {
      id: `${epochId}-EVT-${String(i + 1).padStart(3, "0")}`,
      timestamp: new Date(epochStart.getTime() + Math.random() * 60000).toISOString(),
      filePath: randomFrom(filePaths),
      action: randomFrom(actions),
      sha256: hashes[(e * eventCount + i) % hashes.length],
      epochId,
      status: status === "TAMPERED" && i === 0 ? "TAMPERED" : status === "PENDING" ? "PENDING" : "VERIFIED",
    };
    events.push(evt);
    allEvents.push(evt);
  }

  epochData.push({
    id: epochId,
    timeStart: epochStart.toISOString(),
    timeEnd: epochEnd.toISOString(),
    eventCount,
    merkleRoot: hashes[e % hashes.length] + hashes[(e + 1) % hashes.length].slice(0, 24),
    status,
    events: events.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
  });
}

// Generate 24h chart data
export const chartData = Array.from({ length: 24 }, (_, i) => {
  const hour = new Date(now.getTime() - (23 - i) * 3600000);
  return {
    time: hour.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    CREATE: Math.floor(Math.random() * 15) + 2,
    MODIFY: Math.floor(Math.random() * 25) + 5,
    DELETE: Math.floor(Math.random() * 8),
  };
});

export const mockEvents = allEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
export const mockEpochs = epochData;

export const mockHealth: HealthService[] = [
  {
    name: "C++ Agent",
    description: "File system monitor agent",
    status: "healthy",
    icon: "Cpu",
    metrics: { "CPU Usage": "4.2%", "Memory": "128 MB", "Status": "Active", "PID": 2847 },
  },
  {
    name: "Redis Queue",
    description: "Event queue broker",
    status: "healthy",
    icon: "Database",
    metrics: { "Queue Depth": 12, "Last Flush": new Date(now.getTime() - 30000).toISOString(), "Memory": "64 MB" },
  },
  {
    name: "Metadata DB (CouchDB)",
    description: "File event metadata storage",
    status: "healthy",
    icon: "HardDrive",
    metrics: { "Connection": "Active", "Total Records": 14832, "Disk Usage": "2.1 GB" },
  },
  {
    name: "Anchor DB (CouchDB)",
    description: "Merkle Root storage",
    status: "degraded",
    icon: "Shield",
    metrics: { "Connection": "Active", "Total Merkle Roots": 1247, "Last Write": new Date(now.getTime() - 120000).toISOString() },
  },
  {
    name: "Blockchain (Hyperledger Fabric)",
    description: "Immutable ledger anchor",
    status: "not_configured",
    icon: "Link",
    metrics: { "Status": "Not Configured — Using CouchDB Anchor DB" },
  },
];

export const dashboardStats = {
  totalEventsToday: allEvents.length + 187,
  verifiedEpochs: epochData.filter((e) => e.status === "VERIFIED").length + 42,
  tamperedEpochs: epochData.filter((e) => e.status === "TAMPERED").length,
  lastAnchorTimestamp: new Date(now.getTime() - 120000).toISOString(),
  queueDepth: 12,
};

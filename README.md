# Warden

Warden is a File Integrity Monitoring (FIM) system. It monitors a specific directory on your machine and logs every time a file is created, modified, or deleted. 

To prevent these security logs from being tampered with or deleted by an attacker, Warden anchors the event logs to a Hyperledger Fabric blockchain. This guarantees the integrity of your audit trail.

---

## What It Does
1. Watches a target folder for file changes in real-time.
2. Queues the events so the system isn't overwhelmed during massive file changes.
3. Groups the events into 60-second chunks (epochs).
4. Hashes the chunk and saves the cryptographic proof (Merkle Root) to a blockchain ledger.
5. Displays a live feed and an audit trail on a web dashboard.

## Features
- **Real-time Monitoring:** Instant detection of file events using native OS APIs (`inotify`).
- **High Throughput:** Can handle bursts of thousands of file changes smoothly.
- **Immutable Audit Trail:** Powered by Hyperledger Fabric.
- **Tamper Detection:** Automatically flags if the underlying database has been altered without a matching blockchain record.
- **Modern Dashboard:** Live UI to track system health and view event logs.

## Tech Stack
- **Sensor:** C++ (with `inotify` and OpenSSL)
- **Message Queue:** Redis
- **Backend:** Node.js (Express)
- **Database:** CouchDB (for fast querying)
- **Blockchain:** Hyperledger Fabric (for immutable proof)
- **Smart Contract:** Go (Chaincode)
- **Frontend:** Next.js, React, Tailwind CSS

---

## Folder Structure

```text
.
├── backend/            # Node.js API that processes events and interacts with the blockchain
├── chaincode/          # Go smart contract deployed to the Fabric network
├── frontend/           # Next.js web dashboard
├── scripts/            # Bash scripts for starting services and managing certificates
├── src/sensor/         # C++ source code for the file monitoring agent
├── fabric_commands.md  # Cheat sheet for interacting with the blockchain
└── system.md           # Deep dive into the system architecture
```

---

## How to Install & Run

### Prerequisites
You need the Hyperledger Fabric binaries (`peer`, `orderer`, `configtxgen`, `fabric-ca-client`) installed and available in your `PATH`. You also need Node.js, Redis, CouchDB, and a C++ compiler.

### 1. Setup the Blockchain Network
If this is your first time setting up the project, you need to generate the cryptographic certificates and the genesis block for the network:

```bash
# Generate MSPs and TLS certs via Fabric CA
./scripts/enroll_all.sh

# Generate the genesis block and channel artifacts
./scripts/setup-network.sh
```

### 2. Start the System
Run the main startup script. This will launch the Fabric nodes, Node.js backend, C++ agent, and the Next.js frontend in the background.

```bash
./start_all.sh
```

### 3. Stop the System
To safely shut down all running background processes:

```bash
./stop_all.sh
```

---

## Usage

1. Start the system using `./start_all.sh`.
2. Open your web browser and navigate to **http://localhost:3000**.
3. Create, modify, or delete files inside your monitored directory (defaults to `/home/rud/monitored_files`).
4. Watch the events stream into the "Live Feed" tab on the dashboard.
5. Every 60 seconds, check the "Epoch Audit" tab to see the events bundled and anchored to the blockchain.

---

## Future Plans
- Support for remote agents (monitoring multiple servers from one dashboard).
- Custom alert rules (e.g., Slack or email notifications for specific file changes).
- Support for monitoring file permissions and ownership changes.

## License
MIT License

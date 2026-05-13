#!/bin/bash

PROJECT_HOME="/home/rud/warden1.0"
LOG_DIR="$PROJECT_HOME/logs"

# Ensure the log directory exists
mkdir -p "$LOG_DIR"

echo "==================================================="
echo "  Starting Warden File Integrity System"
echo "==================================================="

# 1. Start Fabric Orderer
echo "[1/5] Starting Fabric Orderer..."
cd "$PROJECT_HOME"
nohup bash scripts/start_orderer.sh > "$LOG_DIR/orderer.log" 2>&1 &
sleep 5 # Give orderer time to spin up

# 2. Start Fabric Peer
echo "[2/5] Starting Fabric Peer..."
cd "$PROJECT_HOME"
nohup bash scripts/start_peer.sh > "$LOG_DIR/peer.log" 2>&1 &
sleep 5 # Give peer time to initialize

# 3. Start Node.js Backend (Aggregator & API)
echo "[3/5] Starting Node.js Backend..."
cd "$PROJECT_HOME/backend"
nohup npm run dev > "$LOG_DIR/backend.log" 2>&1 &

# 4. Start C++ Monitoring Agent (Sensor)
echo "[4/5] Starting C++ Security Agent..."
cd "$PROJECT_HOME"
nohup ./bin/monitoringAgent > "$LOG_DIR/agent.log" 2>&1 &

# 5. Start Next.js Frontend (Dashboard)
echo "[5/5] Starting Next.js Frontend..."
cd "$PROJECT_HOME/frontend"
nohup npm run dev > "$LOG_DIR/frontend.log" 2>&1 &

echo "==================================================="
echo " Warden successfully launched in the background!"
echo " "
echo " Services:"
echo "    - CouchDB      : http://127.0.0.1:5984/_utils"
echo "    - Node API     : http://localhost:5000/api/health"
echo "    - Dashboard    : http://localhost:3000"
echo " "
echo " Logs are being saved to: $LOG_DIR"
echo "      (e.g., tail -f $LOG_DIR/backend.log)"
echo " "
echo " To manually stop all processes later, run:"
echo "    bash $PROJECT_HOME/stop_all.sh"
echo "==================================================="

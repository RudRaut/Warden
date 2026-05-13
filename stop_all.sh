#!/bin/bash

echo "Stopping Warden File Integrity System processes..."

# Stop specific matching patterns to avoid killing unrelated services
pkill -f "orderer"
pkill -f "peer node start"
pkill -f "monitoringAgent"
pkill -f "warden-backend"
pkill -f "node src/index.js"
pkill -f "next"

echo "All Warden processes stopped."

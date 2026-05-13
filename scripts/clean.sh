#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/env.sh"

echo "Stopping Warden processes..."
pkill -9 peer || true
pkill -9 orderer || true

echo "Cleaning ledgers and artifacts..."
rm -rf $PROJECT_HOME/data/orderer/*
rm -rf $PROJECT_HOME/data/peer0.org1/*
rm -rf $PROJECT_HOME/channel-artifacts/*
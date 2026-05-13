#!/bin/bash
# Source central environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/env.sh"

# --- IDENTITY ---
export CORE_PEER_ID=peer0.org1.example.com
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_MSPCONFIGPATH=$PROJECT_HOME/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp

# --- TLS CONFIG ---
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_CERT_FILE=$PROJECT_HOME/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/signcerts/cert.pem
export CORE_PEER_TLS_KEY_FILE=$PROJECT_HOME/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/keystore/priv_sk.pem
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_TLS_CA

# --- NETWORK ---
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_LISTENADDRESS=0.0.0.0:7051
export CORE_PEER_CHAINCODEADDRESS=localhost:7052
export CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052
export CORE_PEER_GOSSIP_EXTERNALENDPOINT=localhost:7051
export CORE_PEER_GOSSIP_BOOTSTRAP=localhost:7051
export CORE_PEER_GOSSIP_USELEADERELECTION=true
export CORE_PEER_GOSSIP_ORGLEADER=false

# --- STORAGE & DB ---
export CORE_PEER_FILESYSTEMPATH=$PROJECT_HOME/data/peer0.org1
export CORE_LEDGER_STATE_STATEDATABASE=CouchDB
export CORE_LEDGER_SNAPSHOTS_ROOTDIR=$PROJECT_HOME/data/peer0.org1/snapshots
export CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=127.0.0.1:5984
export CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
export CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw

# --- VM & METRICS ---
export CORE_VM_ENDPOINT=unix:///var/run/docker.sock
export CORE_VM_DOCKER_HOSTCONFIG_NETWORKMODE=host

echo "Starting Warden Peer on 0.0.0.0:7051..."
peer node start
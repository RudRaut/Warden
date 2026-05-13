#!/bin/bash
# Source central environment variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/env.sh"

# --- IDENTITY ---
export ORDERER_GENERAL_LOCALMSPID=OrdererMSP
export ORDERER_GENERAL_LOCALMSPDIR=$PROJECT_HOME/organizations/ordererOrganizations/orderer.example.com/orderers/orderer.example.com/msp

# --- TLS CONFIG ---
export ORDERER_GENERAL_TLS_ENABLED=true
export ORDERER_GENERAL_TLS_PRIVATEKEY=$PROJECT_HOME/organizations/ordererOrganizations/orderer.example.com/orderers/orderer.example.com/tls/keystore/priv_sk.pem
export ORDERER_GENERAL_TLS_CERTIFICATE=$PROJECT_HOME/organizations/ordererOrganizations/orderer.example.com/orderers/orderer.example.com/tls/signcerts/cert.pem
export ORDERER_GENERAL_TLS_ROOTCAS=$ORDERER_TLS_CA

# --- RAFT CLUSTER TLS ---
export ORDERER_GENERAL_CLUSTER_CLIENTCERTIFICATE=$ORDERER_GENERAL_TLS_CERTIFICATE
export ORDERER_GENERAL_CLUSTER_CLIENTPRIVATEKEY=$ORDERER_GENERAL_TLS_PRIVATEKEY
export ORDERER_GENERAL_CLUSTER_ROOTCAS=$ORDERER_TLS_CA

# --- NETWORK ---
export ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
export ORDERER_GENERAL_LISTENPORT=7050
export ORDERER_ADMIN_LISTENADDRESS=0.0.0.0:9445

# --- ADMIN TLS (for osnadmin) ---
export ORDERER_ADMIN_TLS_ENABLED=true
export ORDERER_ADMIN_TLS_PRIVATEKEY=$ORDERER_GENERAL_TLS_PRIVATEKEY
export ORDERER_ADMIN_TLS_CERTIFICATE=$ORDERER_GENERAL_TLS_CERTIFICATE
export ORDERER_ADMIN_TLS_CLIENTAUTHREQUIRED=true
export ORDERER_ADMIN_TLS_CLIENTROOTCAS=$ORDERER_TLS_CA

# --- STORAGE ---
export ORDERER_GENERAL_BOOTSTRAPMETHOD=file
export ORDERER_GENERAL_BOOTSTRAPFILE=$PROJECT_HOME/system-genesis.block
export ORDERER_FILELEDGER_LOCATION=$PROJECT_HOME/data/orderer/ledger
export ORDERER_GENERAL_WALDIR=$PROJECT_HOME/data/orderer/etcdraft/wal
export ORDERER_GENERAL_SNAPDIR=$PROJECT_HOME/data/orderer/etcdraft/snapshot

echo "Starting Warden Orderer on 0.0.0.0:7050..."
orderer
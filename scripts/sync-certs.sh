#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/env.sh"

# 1. Fix Orderer Organization MSP
mkdir -p $PROJECT_HOME/organizations/ordererOrganizations/orderer.example.com/msp/tlscacerts
cp $ORDERER_TLS_CA $PROJECT_HOME/organizations/ordererOrganizations/orderer.example.com/msp/tlscacerts/

# 2. Fix the specific Orderer Binary MSP
mkdir -p $PROJECT_HOME/organizations/ordererOrganizations/orderer.example.com/orderers/orderer.example.com/msp/tlscacerts
cp $ORDERER_TLS_CA $PROJECT_HOME/organizations/ordererOrganizations/orderer.example.com/orderers/orderer.example.com/msp/tlscacerts/

# 3. Fix Peer Org Trust
mkdir -p $PROJECT_HOME/organizations/peerOrganizations/org1.example.com/msp/tlscacerts
cp $PEER0_TLS_CA $PROJECT_HOME/organizations/peerOrganizations/org1.example.com/msp/tlscacerts/
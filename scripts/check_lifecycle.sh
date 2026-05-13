#!/bin/bash
# Helper script to query lifecycle status with Admin privileges
# This satisfies the local MSP 'Admins' policy check.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/env.sh"

# Direct the peer command to use the Org Admin's MSP identity
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_MSPCONFIGPATH=$ORG1_ADMIN_MSP

echo "--- 1. Querying Installed Chaincode Packages ---"
peer lifecycle chaincode queryinstalled

echo ""
echo "--- 2. Checking Committed Chaincodes on Channel: $CHANNEL_NAME ---"
peer lifecycle chaincode querycommitted -C $CHANNEL_NAME

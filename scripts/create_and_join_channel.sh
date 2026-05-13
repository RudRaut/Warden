#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/env.sh"

# Admin Identity (org1admin — has OU=admin)
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_MSPCONFIGPATH=$ORG1_ADMIN_MSP

# TLS
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_TLS_ROOTCERT_FILE=$PEER0_TLS_CA
export CORE_PEER_ADDRESS=localhost:7051

echo "### Creating channel '$CHANNEL_NAME' ###"
peer channel create -o localhost:7050 -c $CHANNEL_NAME \
    --ordererTLSHostnameOverride localhost \
    -f $PROJECT_HOME/channel-artifacts/${CHANNEL_NAME}.tx \
    --outputBlock $PROJECT_HOME/channel-artifacts/${CHANNEL_NAME}.block \
    --tls --cafile $ORDERER_TLS_CA

echo "### Joining Peer to channel '$CHANNEL_NAME' ###"
peer channel join -b $PROJECT_HOME/channel-artifacts/${CHANNEL_NAME}.block

echo "### Setting anchor peer ###"
peer channel update -o localhost:7050 -c $CHANNEL_NAME \
    --ordererTLSHostnameOverride localhost \
    -f $PROJECT_HOME/channel-artifacts/Org1MSPanchors.tx \
    --tls --cafile $ORDERER_TLS_CA 2>/dev/null || echo "(Anchor peer update skipped — optional for single-peer setup)"

echo "### Channel setup complete ###"
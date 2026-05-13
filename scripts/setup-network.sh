#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/env.sh"

echo "Syncing MSP and TLS certs..."
mkdir -p $PROJECT_HOME/organizations/ordererOrganizations/orderer.example.com/msp/tlscacerts
cp $ORDERER_TLS_CA $PROJECT_HOME/organizations/ordererOrganizations/orderer.example.com/msp/tlscacerts/

mkdir -p $PROJECT_HOME/organizations/peerOrganizations/org1.example.com/msp/tlscacerts
cp $PEER0_TLS_CA $PROJECT_HOME/organizations/peerOrganizations/org1.example.com/msp/tlscacerts/

echo "Generating Genesis and Channel Transactions..."
configtxgen -profile WardenGenesis -channelID system-channel -outputBlock $PROJECT_HOME/system-genesis.block
configtxgen -profile WardenChannel -outputCreateChannelTx $PROJECT_HOME/channel-artifacts/${CHANNEL_NAME}.tx -channelID $CHANNEL_NAME

echo "Network prepared for 'kotaro' environment."
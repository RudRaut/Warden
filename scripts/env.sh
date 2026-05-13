#!/bin/bash
export PROJECT_HOME=/home/rud/warden1.0
export FABRIC_CFG_PATH=$PROJECT_HOME/config
export PATH=$PATH:~/fabric/fabric-samples/bin

# TLS CA Paths (single CA — shared TLS root)
export ORDERER_TLS_CA=$PROJECT_HOME/organizations/ordererOrganizations/orderer.example.com/orderers/orderer.example.com/tls/tlscacerts/tls-localhost-7054.pem
export PEER0_TLS_CA=$PROJECT_HOME/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/tlscacerts/tls-localhost-7054.pem

# Admin MSP Paths
export ORG1_ADMIN_MSP=$PROJECT_HOME/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export ORDERER_ADMIN_MSP=$PROJECT_HOME/organizations/ordererOrganizations/orderer.example.com/users/Admin@orderer.example.com/msp


# Channel
export CHANNEL_NAME=warden2
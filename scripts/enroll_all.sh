#!/bin/bash
set -e

PROJECT_HOME=/home/rud/warden1.0
CA_URL=http://localhost:7054
export FABRIC_CA_CLIENT_HOME=$PROJECT_HOME/organizations/fabric-ca/org1

ORDERER_ORG=$PROJECT_HOME/organizations/ordererOrganizations/orderer.example.com
PEER_ORG=$PROJECT_HOME/organizations/peerOrganizations/org1.example.com

# --- NodeOUs config (same for all MSP dirs) ---
write_config_yaml() {
    cat > "$1/config.yaml" << 'EOF'
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/localhost-7054.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/localhost-7054.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/localhost-7054.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/localhost-7054.pem
    OrganizationalUnitIdentifier: orderer
EOF
    echo "  -> config.yaml written to $1"
}

# ============================================================
# 1. ORDERER IDENTITY (MSP)
# ============================================================
echo "=== Enrolling orderer MSP ==="
mkdir -p $ORDERER_ORG/orderers/orderer.example.com/msp
fabric-ca-client enroll -u ${CA_URL//:\/\//:\/\/orderer:ordererpw@} \
    --mspdir $ORDERER_ORG/orderers/orderer.example.com/msp \
    --csr.hosts localhost,kotaro

# 2. ORDERER TLS
echo "=== Enrolling orderer TLS ==="
mkdir -p $ORDERER_ORG/orderers/orderer.example.com/tls
fabric-ca-client enroll -u ${CA_URL//:\/\//:\/\/orderer:ordererpw@} \
    --mspdir $ORDERER_ORG/orderers/orderer.example.com/tls \
    --enrollment.profile tls \
    --csr.hosts localhost,kotaro

# Rename the TLS private key for consistency
TLS_KEY=$(ls $ORDERER_ORG/orderers/orderer.example.com/tls/keystore/*_sk 2>/dev/null | head -1)
if [ -n "$TLS_KEY" ]; then
    cp "$TLS_KEY" $ORDERER_ORG/orderers/orderer.example.com/tls/keystore/priv_sk.pem
fi

# 3. ORDERER ADMIN
echo "=== Enrolling ordererAdmin MSP ==="
mkdir -p $ORDERER_ORG/users/Admin@orderer.example.com/msp
fabric-ca-client enroll -u ${CA_URL//:\/\//:\/\/ordererAdmin:ordereradminpw@} \
    --mspdir $ORDERER_ORG/users/Admin@orderer.example.com/msp

# ============================================================
# 4. PEER IDENTITY (MSP)
# ============================================================
echo "=== Enrolling peer0 MSP ==="
mkdir -p $PEER_ORG/peers/peer0.org1.example.com/msp
fabric-ca-client enroll -u ${CA_URL//:\/\//:\/\/peer0:peer0pw@} \
    --mspdir $PEER_ORG/peers/peer0.org1.example.com/msp \
    --csr.hosts localhost,kotaro

# 5. PEER TLS
echo "=== Enrolling peer0 TLS ==="
mkdir -p $PEER_ORG/peers/peer0.org1.example.com/tls
fabric-ca-client enroll -u ${CA_URL//:\/\//:\/\/peer0:peer0pw@} \
    --mspdir $PEER_ORG/peers/peer0.org1.example.com/tls \
    --enrollment.profile tls \
    --csr.hosts localhost,kotaro,peer0.org1.example.com

TLS_KEY=$(ls $PEER_ORG/peers/peer0.org1.example.com/tls/keystore/*_sk 2>/dev/null | head -1)
if [ -n "$TLS_KEY" ]; then
    cp "$TLS_KEY" $PEER_ORG/peers/peer0.org1.example.com/tls/keystore/priv_sk.pem
fi

# 6. ORG1 ADMIN
echo "=== Enrolling org1admin MSP ==="
mkdir -p $PEER_ORG/users/Admin@org1.example.com/msp
fabric-ca-client enroll -u ${CA_URL//:\/\//:\/\/org1admin:org1adminpw@} \
    --mspdir $PEER_ORG/users/Admin@org1.example.com/msp

# ============================================================
# 7. BUILD ORG-LEVEL MSPs (for configtx)
# ============================================================
echo "=== Building Orderer Org-Level MSP ==="
mkdir -p $ORDERER_ORG/msp/{cacerts,tlscacerts}
cp $ORDERER_ORG/orderers/orderer.example.com/msp/cacerts/* $ORDERER_ORG/msp/cacerts/
cp $ORDERER_ORG/orderers/orderer.example.com/tls/tlscacerts/* $ORDERER_ORG/msp/tlscacerts/

echo "=== Building Peer Org-Level MSP ==="
mkdir -p $PEER_ORG/msp/{cacerts,tlscacerts}
cp $PEER_ORG/peers/peer0.org1.example.com/msp/cacerts/* $PEER_ORG/msp/cacerts/
cp $PEER_ORG/peers/peer0.org1.example.com/tls/tlscacerts/* $PEER_ORG/msp/tlscacerts/

# ============================================================
# 8. ADD tlscacerts TO ALL MSPs THAT NEED IT
# ============================================================
# Orderer node MSP needs tlscacerts
mkdir -p $ORDERER_ORG/orderers/orderer.example.com/msp/tlscacerts
cp $ORDERER_ORG/orderers/orderer.example.com/tls/tlscacerts/* $ORDERER_ORG/orderers/orderer.example.com/msp/tlscacerts/

# Peer node MSP needs tlscacerts
mkdir -p $PEER_ORG/peers/peer0.org1.example.com/msp/tlscacerts
cp $PEER_ORG/peers/peer0.org1.example.com/tls/tlscacerts/* $PEER_ORG/peers/peer0.org1.example.com/msp/tlscacerts/

# ============================================================
# 9. WRITE config.yaml TO ALL MSP DIRECTORIES
# ============================================================
echo "=== Writing config.yaml to all MSP dirs ==="
write_config_yaml $ORDERER_ORG/msp
write_config_yaml $ORDERER_ORG/orderers/orderer.example.com/msp
write_config_yaml $ORDERER_ORG/users/Admin@orderer.example.com/msp
write_config_yaml $PEER_ORG/msp
write_config_yaml $PEER_ORG/peers/peer0.org1.example.com/msp
write_config_yaml $PEER_ORG/users/Admin@org1.example.com/msp

# ============================================================
# 10. VERIFY OUs
# ============================================================
echo ""
echo "=== VERIFICATION ==="
echo "Orderer cert OU:"
openssl x509 -in $ORDERER_ORG/orderers/orderer.example.com/msp/signcerts/cert.pem -noout -subject
echo "Orderer Admin cert OU:"
openssl x509 -in $ORDERER_ORG/users/Admin@orderer.example.com/msp/signcerts/cert.pem -noout -subject
echo "Peer0 cert OU:"
openssl x509 -in $PEER_ORG/peers/peer0.org1.example.com/msp/signcerts/cert.pem -noout -subject
echo "Org1 Admin cert OU:"
openssl x509 -in $PEER_ORG/users/Admin@org1.example.com/msp/signcerts/cert.pem -noout -subject
echo ""
echo "=== All enrollments complete ==="

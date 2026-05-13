import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
    port: parseInt(process.env.PORT || '5000', 10),

    // CouchDB
    couchUrl: process.env.COUCH_URL || 'http://admin:adminpw@127.0.0.1:5984',
    couchDb: process.env.COUCH_DB || 'warden_fim',

    // Redis
    redisHost: process.env.REDIS_HOST || '127.0.0.1',
    redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),

    // Fabric
    fabricCcpPath: path.resolve(__dirname, '..', process.env.FABRIC_CCP_PATH || '../organizations/peerOrganizations/org1.example.com/connection-org1.json'),
    fabricWalletPath: path.resolve(__dirname, '..', process.env.FABRIC_WALLET_PATH || './wallet'),
    fabricIdentity: process.env.FABRIC_IDENTITY || 'admin',
    fabricChannel: process.env.FABRIC_CHANNEL || 'warden2',
    fabricChaincode: process.env.FABRIC_CHAINCODE || 'warden',

    // Epoch
    epochIntervalMs: parseInt(process.env.EPOCH_INTERVAL_MS || '60000', 10),   // 60 seconds default
    retryIntervalMs: 10_000,   // 10 seconds for retry worker
    maxRetries: 3,
};

export default config;

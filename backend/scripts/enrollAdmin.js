/**
 * Enroll Admin — One-time wallet bootstrap script.
 *
 * Reads the existing Admin identity from the organizations/ MSP directory
 * and imports it into a FileSystemWallet that fabric-network can use.
 *
 * Usage: npm run enroll
 *
 * Source MSP:
 *   organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/
 *     ├── signcerts/cert.pem
 *     └── keystore/*_sk
 */

import { Wallets } from 'fabric-network';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WALLET_PATH = path.resolve(__dirname, '..', 'wallet');
const MSP_PATH = path.resolve(
    __dirname,
    '..',
    '..',
    'organizations',
    'peerOrganizations',
    'org1.example.com',
    'users',
    'Admin@org1.example.com',
    'msp'
);

async function main() {
    console.log('[WALLET] Importing Admin identity into Fabric wallet...');
    console.log(`[WALLET] MSP source: ${MSP_PATH}`);
    console.log(`[WALLET] Wallet target: ${WALLET_PATH}`);

    // 1. Read the certificate
    const certDir = path.join(MSP_PATH, 'signcerts');
    if (!fs.existsSync(certDir)) {
        console.error(`[WALLET] ERROR: signcerts directory not found at ${certDir}`);
        console.error('[WALLET] Have you run enroll_all.sh on the Fabric device?');
        process.exit(1);
    }

    const certFiles = fs.readdirSync(certDir).filter(f => f.endsWith('.pem'));
    if (certFiles.length === 0) {
        console.error('[WALLET] ERROR: No .pem certificate found in signcerts/');
        process.exit(1);
    }

    const certificate = fs.readFileSync(path.join(certDir, certFiles[0]), 'utf8');
    console.log(`[WALLET] Certificate loaded: ${certFiles[0]}`);

    // 2. Read the private key
    const keyDir = path.join(MSP_PATH, 'keystore');
    if (!fs.existsSync(keyDir)) {
        console.error(`[WALLET] ERROR: keystore directory not found at ${keyDir}`);
        process.exit(1);
    }

    const keyFiles = fs.readdirSync(keyDir).filter(f => f.endsWith('_sk') || f.endsWith('.pem'));
    if (keyFiles.length === 0) {
        console.error('[WALLET] ERROR: No private key found in keystore/');
        console.error('[WALLET] Expected a file ending in _sk or .pem');
        process.exit(1);
    }

    const privateKey = fs.readFileSync(path.join(keyDir, keyFiles[0]), 'utf8');
    console.log(`[WALLET] Private key loaded: ${keyFiles[0]}`);

    // 3. Create the wallet and import the identity
    const wallet = await Wallets.newFileSystemWallet(WALLET_PATH);

    const identity = {
        credentials: {
            certificate,
            privateKey,
        },
        mspId: 'Org1MSP',
        type: 'X.509',
    };

    await wallet.put('admin', identity);

    console.log('');
    console.log('[WALLET] ✓ Admin identity imported into wallet at ./wallet');
    console.log('[WALLET] Done. The backend can now connect to Fabric.');
}

main().catch(err => {
    console.error('[WALLET] Fatal error:', err);
    process.exit(1);
});

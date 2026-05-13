/**
 * Fabric SDK Service — connects to Hyperledger Fabric via fabric-network.
 *
 * Uses the chaincode functions from warden.go:
 *   - RecordEpoch(epochID, merkleRoot, eventCount, timestamp)
 *   - GetEpoch(epochID)
 *
 * Graceful degradation: if wallet or CCP is missing, the service
 * operates in "offline" mode — logging warnings but not crashing.
 */

import { Gateway, Wallets } from 'fabric-network';
import fs from 'fs';
import path from 'path';
import config from '../config.js';
import * as couchService from './couchService.js';

let gateway = null;
let contract = null;
let fabricAvailable = false;

export async function initFabric() {
    try {
        // Check if connection profile exists
        if (!fs.existsSync(config.fabricCcpPath)) {
            console.warn(`[FABRIC] Connection profile not found at ${config.fabricCcpPath}`);
            console.warn('[FABRIC] Running in CouchDB-only mode (no blockchain anchoring).');
            return false;
        }

        // Check if wallet exists
        if (!fs.existsSync(config.fabricWalletPath)) {
            console.warn(`[FABRIC] Wallet not found at ${config.fabricWalletPath}`);
            console.warn('[FABRIC] Run "npm run enroll" to create the wallet first.');
            console.warn('[FABRIC] Running in CouchDB-only mode.');
            return false;
        }

        const ccp = JSON.parse(fs.readFileSync(config.fabricCcpPath, 'utf8'));
        const wallet = await Wallets.newFileSystemWallet(config.fabricWalletPath);

        // Check if the identity exists in the wallet
        const identity = await wallet.get(config.fabricIdentity);
        if (!identity) {
            console.warn(`[FABRIC] Identity '${config.fabricIdentity}' not found in wallet.`);
            console.warn('[FABRIC] Run "npm run enroll" to import the identity.');
            console.warn('[FABRIC] Running in CouchDB-only mode.');
            return false;
        }

        gateway = new Gateway();
        await gateway.connect(ccp, {
            wallet,
            identity: config.fabricIdentity,
            discovery: { enabled: true, asLocalhost: true },
        });

        const network = await gateway.getNetwork(config.fabricChannel);
        contract = network.getContract(config.fabricChaincode);

        fabricAvailable = true;
        console.log('[FABRIC] Connected. Blockchain anchoring enabled.');
        return true;
    } catch (err) {
        console.error('[FABRIC] Init failed:', err.message);
        console.warn('[FABRIC] Running in CouchDB-only mode.');
        fabricAvailable = false;
        return false;
    }
}

/**
 * Anchor an epoch to the blockchain with retry logic.
 *
 * - 3 retries with exponential backoff (1s, 2s, 4s)
 * - On success: update CouchDB batch status to COMMITTED
 * - On failure: CouchDB data is preserved (already written before this call)
 *
 * This function is fire-and-forget (called async by epochManager).
 */
export async function anchorEpoch(epochId, merkleRoot, eventCount, timestamp, firstEventTs = 0) {
    if (!fabricAvailable || !contract) {
        console.warn(`[FABRIC] Offline — epoch ${epochId} will remain PENDING in CouchDB.`);
        return false;
    }

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
            const anchorStart = Date.now();
            await contract.submitTransaction(
                'RecordEpoch',
                epochId,
                merkleRoot,
                String(eventCount),
                timestamp
            );
            const anchorEnd = Date.now();
            const anchorLatencyMs = anchorEnd - anchorStart;
            const e2eLatencyMs = firstEventTs > 0 ? anchorEnd - firstEventTs : -1;

            // Success — update CouchDB
            await couchService.updateBatchStatus(epochId, 'COMMITTED');
            // Parsed by calculate_results.py for Metrics 2 and 3
            console.log(`[FABRIC_PERF] epoch=${epochId} anchor_latency_ms=${anchorLatencyMs} e2e_latency_ms=${e2eLatencyMs} events=${eventCount} confirmed_ts=${anchorEnd}`);
            return true;
        } catch (err) {
            // If the epoch was already anchored (previous attempt succeeded on
            // the ledger but CouchDB status update failed), treat as success.
            if (err.message && err.message.includes('already has an anchored record')) {
                console.log(`[FABRIC] Epoch ${epochId} was already on the ledger. Updating CouchDB status.`);
                await couchService.updateBatchStatus(epochId, 'COMMITTED');
                return true;
            }

            const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
            console.error(`[FABRIC] Attempt ${attempt}/${config.maxRetries} failed for ${epochId}: ${err.message}`);

            if (attempt < config.maxRetries) {
                console.log(`[FABRIC] Retrying in ${delay}ms...`);
                await sleep(delay);
            }
        }
    }

    console.error(`[FABRIC] FAILED to anchor epoch ${epochId} after ${config.maxRetries} retries.`);
    console.log(`[FABRIC] Data is safely stored in CouchDB with status=PENDING.`);
    return false;
}

/**
 * Query the blockchain for an epoch record.
 */
export async function queryEpoch(epochId) {
    if (!fabricAvailable || !contract) {
        return { error: 'Fabric is not available', offline: true };
    }

    try {
        const result = await contract.evaluateTransaction('GetEpoch', epochId);
        return JSON.parse(result.toString());
    } catch (err) {
        console.error(`[FABRIC] Query failed for ${epochId}:`, err.message);
        return { error: err.message };
    }
}

/**
 * Retry worker — called periodically to re-anchor PENDING batches.
 */
export async function retryPendingBatches() {
    if (!fabricAvailable) return;

    const pending = await couchService.getPendingBatches();
    if (pending.length === 0) return;

    console.log(`[FABRIC] Retry worker: ${pending.length} pending batch(es) found.`);

    for (const batch of pending) {
        // Get event count for this batch
        const events = await couchService.getLogsByEpoch(batch.epochId);
        const eventCount = events.length;
        const timestamp = events[0]?.timestamp || new Date().toISOString();

        await anchorEpoch(batch.epochId, batch.merkleRoot, eventCount, timestamp);
    }
}

export function isFabricAvailable() {
    return fabricAvailable;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

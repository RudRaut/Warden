/**
 * Epoch Manager — the heartbeat of Warden.
 *
 * Every 60 seconds:
 *   1. Drain Redis buffer
 *   2. Build Merkle root from file hashes
 *   3. Save to CouchDB (status=PENDING) — data is NEVER lost
 *   4. Fire-and-forget anchor to Fabric blockchain
 */

import config from '../config.js';
import { drainBuffer } from './redisConsumer.js';
import { buildMerkleRoot } from './merkle.js';
import * as couchService from './couchService.js';
import * as fabricService from './fabricService.js';

let epochTimer = null;
let retryTimer = null;

export function startEpochManager() {
    console.log(`[EPOCH] Manager started. Interval: ${config.epochIntervalMs / 1000}s`);

    // Main epoch loop
    epochTimer = setInterval(processEpoch, config.epochIntervalMs);

    // Retry worker for PENDING batches (every 10s)
    retryTimer = setInterval(() => {
        fabricService.retryPendingBatches().catch(err => {
            console.error('[EPOCH] Retry worker error:', err.message);
        });
    }, config.retryIntervalMs);
}

async function processEpoch() {
    try {
        // 1. Drain all buffered events from Redis
        const events = await drainBuffer();

        if (events.length === 0) {
            console.log('[EPOCH] Window closed. No activity.');
            return;
        }

        // 2. Generate epoch ID
        const epochTs = Math.floor(Date.now() / 1000);
        const epochId = `E-${epochTs}`;

        // 3. Build Merkle root from file hashes only
        const hashes = events.map(e => e.hash).filter(Boolean);
        const merkleRoot = buildMerkleRoot(hashes);

        if (!merkleRoot) {
            console.warn(`[EPOCH] ${epochId}: No valid hashes found. Skipping.`);
            return;
        }

        console.log(`[EPOCH] ${epochId}: ${events.length} events, Merkle Root: ${merkleRoot.substring(0, 16)}...`);

        // 4. ALWAYS save to CouchDB first (status=PENDING)
        const saved = await couchService.saveBatch(events, epochId, merkleRoot);
        if (!saved) {
            console.error(`[EPOCH] ${epochId}: CouchDB write FAILED. Events may be lost!`);
            return;
        }

        // 5. Fire-and-forget: anchor to blockchain
        //    This runs async — it won't block the next epoch.
        const timestamp = events[0]?.time || new Date().toISOString();
        // firstEventTs: earliest agent_ts (ms) across all events — used for E2E latency (Metric 2)
        const agentTs = events.map(e => e.agent_ts).filter(ts => ts && ts > 0);
        const firstEventTs = agentTs.length > 0 ? Math.min(...agentTs) : 0;
        fabricService.anchorEpoch(epochId, merkleRoot, events.length, timestamp, firstEventTs)
            .catch(err => {
                console.error(`[EPOCH] ${epochId}: Blockchain anchor error:`, err.message);
            });

    } catch (err) {
        console.error('[EPOCH] processEpoch error:', err.message);
    }
}

export function stopEpochManager() {
    if (epochTimer) clearInterval(epochTimer);
    if (retryTimer) clearInterval(retryTimer);
    console.log('[EPOCH] Manager stopped.');
}

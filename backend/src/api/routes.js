/**
 * REST API Routes — Express router serving the Next.js frontend.
 *
 * All routes return JSON. CORS is enabled in index.js.
 */

import { Router } from 'express';
import * as couchService from '../services/couchService.js';
import * as fabricService from '../services/fabricService.js';
import * as redisConsumer from '../services/redisConsumer.js';
import { buildMerkleRoot } from '../services/merkle.js';

const router = Router();

// ─── GET /api/logs ──────────────────────────────────────────
// Fetch all event logs from CouchDB
router.get('/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 200;
        const skip = parseInt(req.query.skip) || 0;
        const logs = await couchService.getAllLogs(limit, skip);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/logs/:epochId ─────────────────────────────────
// Fetch all events for a specific epoch
router.get('/logs/:epochId', async (req, res) => {
    try {
        const logs = await couchService.getLogsByEpoch(req.params.epochId);
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/epochs ────────────────────────────────────────
// Fetch all distinct epochs with aggregated metadata
router.get('/epochs', async (req, res) => {
    try {
        const epochs = await couchService.getEpochs();
        res.json(epochs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/verify/:batchId ───────────────────────────────
// Re-compute Merkle root from CouchDB events, compare with stored + blockchain
router.get('/verify/:batchId', async (req, res) => {
    try {
        const { batchId } = req.params;

        // 1. Fetch events for this epoch from CouchDB
        const events = await couchService.getLogsByEpoch(batchId);
        if (events.length === 0) {
            return res.status(404).json({ error: `No events found for batch ${batchId}` });
        }

        // 2. Re-compute Merkle root from the file hashes
        const hashes = events.map(e => e.file_hash).filter(Boolean);
        const recalculatedRoot = buildMerkleRoot(hashes);

        // 3. Get the stored Merkle root (from CouchDB doc)
        const storedRoot = events[0]?.merkle_root;

        // 4. Query blockchain if available
        let blockchainRoot = null;
        let blockchainRecord = null;
        const ledgerResult = await fabricService.queryEpoch(batchId);
        if (!ledgerResult.error && !ledgerResult.offline) {
            blockchainRoot = ledgerResult.merkleRoot;
            blockchainRecord = ledgerResult;
        }

        // 5. Determine status
        let status = 'VERIFIED';

        // Check CouchDB integrity
        if (recalculatedRoot !== storedRoot) {
            status = 'TAMPERED';
        }

        // Check blockchain integrity (if available)
        if (blockchainRoot && recalculatedRoot !== blockchainRoot) {
            status = 'TAMPERED';
        }

        res.json({
            batch_id: batchId,
            status,
            event_count: events.length,
            recalculated_root: recalculatedRoot,
            stored_root: storedRoot,
            blockchain_root: blockchainRoot,
            blockchain_available: !ledgerResult.offline && !ledgerResult.error,
            blockchain_record: blockchainRecord,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/ledger/:batchId ───────────────────────────────
// Query Fabric ledger directly for an epoch record
router.get('/ledger/:batchId', async (req, res) => {
    try {
        const result = await fabricService.queryEpoch(req.params.batchId);
        if (result.error) {
            return res.status(result.offline ? 503 : 404).json(result);
        }
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/audit ─────────────────────────────────────────
// Verify ALL epochs in bulk
router.get('/audit', async (req, res) => {
    try {
        const auditStart = Date.now();
        const epochs = await couchService.getEpochs();
        let verified = 0;
        let tampered = 0;
        let pending = 0;
        const results = [];

        for (const epoch of epochs) {
            const events = await couchService.getLogsByEpoch(epoch.id);
            const hashes = events.map(e => e.file_hash).filter(Boolean);
            const recalculated = buildMerkleRoot(hashes);

            let status;
            if (epoch.status === 'PENDING') {
                status = 'PENDING';
                pending++;
            } else {
                let expectedRoot = epoch.merkleRoot;
                const ledgerResult = await fabricService.queryEpoch(epoch.id);
                
                if (ledgerResult && !ledgerResult.error && !ledgerResult.offline) {
                    expectedRoot = ledgerResult.merkleRoot;
                }

                if (recalculated === expectedRoot && recalculated === epoch.merkleRoot) {
                    status = 'VERIFIED';
                    verified++;
                } else {
                    status = 'TAMPERED';
                    tampered++;
                }
            }

            results.push({
                id: epoch.id,
                status,
                eventCount: epoch.eventCount,
                merkleRoot: epoch.merkleRoot,
                recalculatedRoot: recalculated,
                match: status === 'VERIFIED',
            });
        }

        const verificationMs = Date.now() - auditStart;
        res.json({ verified, tampered, pending, total: epochs.length, verification_ms: verificationMs, epochs: results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/queue-depth ───────────────────────────────────
// Current Redis queue length
router.get('/queue-depth', async (req, res) => {
    try {
        const depth = await redisConsumer.getQueueDepth();
        res.json({ queueDepth: depth });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/health ────────────────────────────────────────
// Status of all backend services
router.get('/health', async (req, res) => {
    try {
        const redisOk = await redisConsumer.isHealthy();
        const couchOk = await couchService.isHealthy();
        const fabricOk = fabricService.isFabricAvailable();

        const services = [
            {
                name: 'C++ Agent',
                description: 'File system monitor agent',
                status: redisOk ? 'healthy' : 'down',
                icon: 'Cpu',
                metrics: { Status: redisOk ? 'Events flowing via Redis' : 'Unknown' },
            },
            {
                name: 'Redis Queue',
                description: 'Event queue broker',
                status: redisOk ? 'healthy' : 'down',
                icon: 'Database',
                metrics: {
                    'Queue Depth': await redisConsumer.getQueueDepth(),
                    Connection: redisOk ? 'Active' : 'Down',
                },
            },
            {
                name: 'Metadata DB (CouchDB)',
                description: 'File event metadata storage',
                status: couchOk ? 'healthy' : 'down',
                icon: 'HardDrive',
                metrics: { Connection: couchOk ? 'Active' : 'Down' },
            },
            {
                name: 'Blockchain (Hyperledger Fabric)',
                description: 'Immutable ledger anchor',
                status: fabricOk ? 'healthy' : 'not_configured',
                icon: 'Link',
                metrics: {
                    Status: fabricOk
                        ? 'Connected'
                        : 'Not Configured — Using CouchDB-only mode',
                },
            },
        ];

        res.json(services);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/search ────────────────────────────────────────
// Search events with query params
router.get('/search', async (req, res) => {
    try {
        const filters = {
            filePath: req.query.filePath,
            action: req.query.action,
            status: req.query.status,
            dateFrom: req.query.dateFrom,
            dateTo: req.query.dateTo,
        };
        const results = await couchService.searchEvents(filters);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/stats ─────────────────────────────────────────
// Dashboard stats: totals, last anchor time, queue depth
router.get('/stats', async (req, res) => {
    try {
        const epochs = await couchService.getEpochs();
        const logs = await couchService.getAllLogs(1); // just for total count reference
        const queueDepth = await redisConsumer.getQueueDepth();

        const committed = epochs.filter(e => e.status === 'COMMITTED');
        const pending = epochs.filter(e => e.status === 'PENDING');

        // Re-verify all committed to find tampered
        let verifiedCount = 0;
        let tamperedCount = 0;
        for (const ep of committed) {
            const events = await couchService.getLogsByEpoch(ep.id);
            const hashes = events.map(e => e.file_hash).filter(Boolean);
            const recalc = buildMerkleRoot(hashes);
            let expectedRoot = ep.merkleRoot;
            const ledgerResult = await fabricService.queryEpoch(ep.id);
            if (ledgerResult && !ledgerResult.error && !ledgerResult.offline) {
                expectedRoot = ledgerResult.merkleRoot;
            }

            if (recalc === expectedRoot && recalc === ep.merkleRoot) {
                verifiedCount++;
            } else {
                tamperedCount++;
            }
        }

        // Last anchor = most recent COMMITTED epoch's timeEnd
        const lastAnchor = committed.length > 0 ? committed[0].timeEnd : null;

        res.json({
            totalEventsToday: epochs.reduce((sum, e) => sum + e.eventCount, 0),
            verifiedEpochs: verifiedCount,
            tamperedEpochs: tamperedCount,
            pendingEpochs: pending.length,
            lastAnchorTimestamp: lastAnchor || new Date().toISOString(),
            queueDepth,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;

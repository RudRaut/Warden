/**
 * CouchDB Storage Service — uses `nano` library.
 *
 * Database: warden_fim
 * Schema per event doc:
 *   docType, batch_id, file_path, file_name, action,
 *   file_hash, file_size, timestamp, merkle_root,
 *   status (PENDING | COMMITTED), blockchain_anchored (bool)
 */

import Nano from 'nano';
import { v4 as uuidv4 } from 'uuid';
import config from '../config.js';

let nano = null;
let db = null;

export async function initCouch() {
    nano = Nano(config.couchUrl);

    // Create database if it doesn't exist
    try {
        await nano.db.create(config.couchDb);
        console.log(`[COUCH] Database '${config.couchDb}' created.`);
    } catch (err) {
        if (err.statusCode === 412 || err.error === 'file_exists') {
            console.log(`[COUCH] Database '${config.couchDb}' already exists.`);
        } else {
            console.error(`[COUCH] Error creating DB:`, err.message);
        }
    }

    db = nano.use(config.couchDb);

    // Create indexes
    await createIndexes();

    return db;
}

async function createIndexes() {
    // Compound indexes — each matches a specific query pattern used in this service
    const indexes = [
        { name: 'idx-docType-timestamp', fields: ['docType', 'timestamp'] },       // getAllLogs(), searchEvents()
        { name: 'idx-batch_id-docType',  fields: ['batch_id', 'docType'] },        // getLogsByEpoch(), updateBatchStatus()
        { name: 'idx-status-docType',    fields: ['status', 'docType'] },          // getPendingBatches()
        { name: 'idx-docType-action',    fields: ['docType', 'action'] },          // searchEvents() with action filter
        { name: 'idx-docType-file_path', fields: ['docType', 'file_path'] },       // searchEvents() with file_path filter
    ];

    for (const idx of indexes) {
        try {
            await db.createIndex({
                index: { fields: idx.fields },
                name: idx.name,
                ddoc: idx.name,
                type: 'json',
            });
        } catch (err) {
            // Index may already exist, that's fine
            if (!err.message?.includes('exists')) {
                console.error(`[COUCH] Index ${idx.name} error:`, err.message);
            }
        }
    }

    // MapReduce design document — aggregates epochs server-side
    await createEpochView();

    console.log('[COUCH] Indexes and views verified.');
}

/**
 * Install a CouchDB MapReduce view that groups events by batch_id.
 * The map emits [batch_id] -> { merkle_root, status, blockchain_anchored, timestamp }.
 * The reduce uses _count to get event counts; we also query with include_docs=false
 * and use a group query to aggregate per epoch.
 */
async function createEpochView() {
    const ddocId = '_design/epochs';
    const ddoc = {
        _id: ddocId,
        views: {
            by_batch: {
                map: [
                    'function (doc) {',
                    '  if (doc.docType === "event") {',
                    '    emit(doc.batch_id, {',
                    '      merkle_root: doc.merkle_root,',
                    '      status: doc.status,',
                    '      blockchain_anchored: doc.blockchain_anchored,',
                    '      timestamp: doc.timestamp',
                    '    });',
                    '  }',
                    '}',
                ].join('\n'),
                reduce: '_count',
            },
        },
    };

    try {
        const existing = await db.get(ddocId);
        ddoc._rev = existing._rev;
    } catch (err) {
        // 404 = first install, that's fine
        if (err.statusCode !== 404) {
            console.error('[COUCH] Error fetching epoch ddoc:', err.message);
        }
    }

    try {
        await db.insert(ddoc);
    } catch (err) {
        console.error('[COUCH] Error installing epoch view:', err.message);
    }
}

/**
 * Save a batch of events to CouchDB.
 * Called BEFORE blockchain anchoring — status starts as PENDING.
 */
export async function saveBatch(events, epochId, merkleRoot) {
    const docs = events.map((e, index) => ({
        _id: uuidv4(),
        docType: 'event',
        event_id: `${epochId}-${index}`,
        batch_id: epochId,
        file_path: e.path,
        file_name: e.file_name,
        action: e.action,
        file_hash: e.hash,
        file_size: e.file_size || 0,
        timestamp: e.time,
        agent_ts: e.agent_ts || 0,
        merkle_root: merkleRoot,
        status: 'PENDING',
        blockchain_anchored: false,
    }));

    try {
        const result = await db.bulk({ docs });
        const failures = result.filter(r => r.error);
        if (failures.length > 0) {
            console.error(`[COUCH] ${failures.length} docs failed to insert.`);
            return false;
        }
        console.log(`[COUCH] Batch ${epochId}: ${docs.length} events saved.`);
        return true;
    } catch (err) {
        console.error(`[COUCH] Bulk insert error:`, err.message);
        return false;
    }
}

/**
 * Update all docs in a batch to COMMITTED status after successful blockchain anchor.
 */
export async function updateBatchStatus(epochId, status = 'COMMITTED') {
    try {
        const result = await db.find({
            selector: { batch_id: epochId, docType: 'event' },
            limit: 10000,
        });

        if (!result.docs || result.docs.length === 0) return;

        const updated = result.docs.map(doc => ({
            ...doc,
            status: status,
            blockchain_anchored: status === 'COMMITTED',
        }));

        await db.bulk({ docs: updated });
        console.log(`[COUCH] Batch ${epochId}: status → ${status}`);
    } catch (err) {
        console.error(`[COUCH] updateBatchStatus error:`, err.message);
    }
}

/**
 * Fetch all event logs, optionally paginated.
 */
export async function getAllLogs(limit = 200, skip = 0) {
    try {
        const result = await db.find({
            selector: { docType: 'event' },
            sort: [{ timestamp: 'desc' }],
            limit,
            skip,
        });
        return result.docs;
    } catch (err) {
        console.error('[COUCH] getAllLogs error:', err.message);
        return [];
    }
}

/**
 * Fetch all events belonging to a specific epoch/batch.
 */
export async function getLogsByEpoch(epochId) {
    try {
        const result = await db.find({
            selector: { batch_id: epochId, docType: 'event' },
            limit: 10000,
        });

        // Sort by the numerical index inside event_id (e.g., "E-123-0", "E-123-1")
        // to guarantee they are in the exact order they were inserted for Merkle root calculation
        result.docs.sort((a, b) => {
            const indexA = parseInt(a.event_id.split('-').pop(), 10);
            const indexB = parseInt(b.event_id.split('-').pop(), 10);
            return indexA - indexB;
        });

        return result.docs;
    } catch (err) {
        console.error(`[COUCH] getLogsByEpoch error:`, err.message);
        return [];
    }
}

/**
 * Get a summary of all distinct epochs.
 * Returns aggregated epoch data: id, event count, merkle root, status, time range.
 */
export async function getEpochs() {
    try {
        // Use the MapReduce view to get event counts per batch, then fetch
        // the metadata (merkle_root, status, timestamps) in a lightweight pass.
        const countResult = await db.view('epochs', 'by_batch', {
            group: true,
            reduce: true,
        });

        // countResult.rows = [{ key: 'E-xxx', value: N }, ...]
        // Now fetch the detailed rows to grab metadata per batch.
        const detailResult = await db.view('epochs', 'by_batch', {
            reduce: false,
            include_docs: false,
        });

        // Build a map from the detailed rows (key=batch_id, value={merkle_root, ...})
        const metaMap = new Map();
        for (const row of detailResult.rows) {
            const batchId = row.key;
            const val = row.value;
            if (!metaMap.has(batchId)) {
                metaMap.set(batchId, {
                    merkleRoot: val.merkle_root,
                    status: val.status,
                    blockchain_anchored: val.blockchain_anchored,
                    timestamps: [val.timestamp],
                });
            } else {
                const meta = metaMap.get(batchId);
                meta.timestamps.push(val.timestamp);
                // If any event is PENDING, the whole batch is PENDING
                if (val.status === 'PENDING') meta.status = 'PENDING';
            }
        }

        // Merge counts + metadata
        return countResult.rows.map(row => {
            const meta = metaMap.get(row.key) || {};
            const ts = (meta.timestamps || []).sort();
            return {
                id: row.key,
                merkleRoot: meta.merkleRoot || null,
                status: meta.status || 'UNKNOWN',
                blockchain_anchored: meta.blockchain_anchored || false,
                eventCount: row.value,
                timeStart: ts[0] || null,
                timeEnd: ts[ts.length - 1] || null,
            };
        }).sort((a, b) => (b.timeStart || '').localeCompare(a.timeStart || ''));
    } catch (err) {
        console.error('[COUCH] getEpochs error:', err.message);
        return [];
    }
}

/**
 * Fetch all batches that are still PENDING (for retry worker).
 */
export async function getPendingBatches() {
    try {
        const result = await db.find({
            selector: { docType: 'event', status: 'PENDING' },
            fields: ['batch_id', 'merkle_root'],
            limit: 50000,
        });

        // Deduplicate by batch_id
        const seen = new Map();
        for (const doc of result.docs) {
            if (!seen.has(doc.batch_id)) {
                seen.set(doc.batch_id, {
                    epochId: doc.batch_id,
                    merkleRoot: doc.merkle_root,
                });
            }
        }
        return Array.from(seen.values());
    } catch (err) {
        console.error('[COUCH] getPendingBatches error:', err.message);
        return [];
    }
}

/**
 * Search events with flexible filters.
 */
export async function searchEvents({ filePath, action, status, dateFrom, dateTo } = {}) {
    try {
        const selector = { docType: 'event' };

        if (filePath) {
            selector.file_path = { $regex: filePath };
        }
        if (action) {
            selector.action = action;
        }
        if (status && status !== 'ALL') {
            selector.status = status;
        }
        if (dateFrom || dateTo) {
            selector.timestamp = {};
            if (dateFrom) selector.timestamp.$gte = dateFrom;
            if (dateTo) selector.timestamp.$lte = dateTo;
        }

        const result = await db.find({
            selector,
            sort: [{ timestamp: 'desc' }],
            limit: 500,
        });
        return result.docs;
    } catch (err) {
        console.error('[COUCH] searchEvents error:', err.message);
        return [];
    }
}

/**
 * Check if CouchDB is alive.
 */
export async function isHealthy() {
    if (!nano) return false;
    try {
        await nano.db.get(config.couchDb);
        return true;
    } catch {
        return false;
    }
}

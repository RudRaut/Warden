/**
 * Redis Consumer — drains the `warden_events` list populated by the C++ sensor.
 *
 * The C++ agent does LPUSH, so we RPOP (FIFO order).
 * Each item is a JSON string: { time, action, path, file_name, hash, file_size }
 */

import Redis from 'ioredis';
import config from '../config.js';

let redis = null;

export function initRedis() {
    redis = new Redis({
        host: config.redisHost,
        port: config.redisPort,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            const delay = Math.min(times * 500, 5000);
            console.log(`[REDIS] Reconnecting in ${delay}ms (attempt ${times})`);
            return delay;
        },
    });

    redis.on('connect', () => console.log('[REDIS] Connected.'));
    redis.on('error', (err) => console.error('[REDIS] Error:', err.message));

    return redis;
}

/**
 * Drain all currently queued events from Redis in one shot.
 *
 * Uses LLEN → LRANGE → LTRIM (3 calls total, regardless of queue size)
 * instead of N individual RPOP calls.
 *
 * Epoch isolation: we snapshot only the items present at drain-time.
 * Any events pushed by the C++ agent *after* our LRANGE will remain
 * in the list and be consumed by the next epoch's drain.
 */
export async function drainBuffer() {
    if (!redis) throw new Error('[REDIS] Not initialized');

    const key = 'warden_events';

    // 1. How many items are queued right now?
    const len = await redis.llen(key);
    if (len === 0) return [];

    // 2. Read all current items (FIFO: agent does LPUSH, we read right-to-left)
    //    LRANGE returns items left-to-right (newest first), so we reverse for FIFO.
    const raw = await redis.lrange(key, 0, len - 1);

    // 3. Atomically remove the items we just read
    await redis.ltrim(key, len, -1);

    // 4. Parse (reverse for FIFO order: oldest first)
    const events = [];
    for (let i = raw.length - 1; i >= 0; i--) {
        try {
            events.push(JSON.parse(raw[i]));
        } catch (err) {
            console.error('[REDIS] Malformed event skipped:', raw[i]);
        }
    }

    return events;
}

/**
 * Get the current queue depth (LLEN warden_events).
 */
export async function getQueueDepth() {
    if (!redis) return 0;
    return redis.llen('warden_events');
}

/**
 * Check if Redis is alive.
 */
export async function isHealthy() {
    if (!redis) return false;
    try {
        const pong = await redis.ping();
        return pong === 'PONG';
    } catch {
        return false;
    }
}

export function getClient() {
    return redis;
}

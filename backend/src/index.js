/**
 * Warden Backend — Entry Point
 *
 * Boots all services in order:
 *   1. CouchDB (create DB + indexes)
 *   2. Redis (connect consumer)
 *   3. Fabric (connect gateway — graceful if missing)
 *   4. Epoch Manager (60s processing loop)
 *   5. Express API server (REST for frontend)
 */

import express from 'express';
import cors from 'cors';
import config from './config.js';
import { initRedis } from './services/redisConsumer.js';
import { initCouch } from './services/couchService.js';
import { initFabric } from './services/fabricService.js';
import { startEpochManager } from './services/epochManager.js';
import apiRoutes from './api/routes.js';

// Prevent crashes from unhandled Fabric SDK / async errors
process.on('unhandledRejection', (reason, promise) => {
    console.error('[PROCESS] Unhandled Rejection:', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
    console.error('[PROCESS] Uncaught Exception:', err.message);
});

async function main() {
    console.log('╔══════════════════════════════════════════╗');
    console.log('║        WARDEN BACKEND v1.0               ║');
    console.log('║   Unified Node.js FIM Aggregator          ║');
    console.log('╚══════════════════════════════════════════╝');
    console.log('');

    // 1. CouchDB
    console.log('── Initializing CouchDB ──');
    await initCouch();

    // 2. Redis
    console.log('── Initializing Redis ──');
    initRedis();

    // 3. Fabric (graceful — won't crash if missing)
    console.log('── Initializing Fabric SDK ──');
    await initFabric();

    // 4. Epoch Manager
    console.log('── Starting Epoch Manager ──');
    startEpochManager();

    // 5. Express API
    const app = express();
    app.use(cors());
    app.use(express.json());

    // Mount API routes
    app.use('/api', apiRoutes);

    // Root health check
    app.get('/', (req, res) => {
        res.json({
            service: 'warden-backend',
            version: '1.0.0',
            status: 'running',
            timestamp: new Date().toISOString(),
        });
    });

    app.listen(config.port, () => {
        console.log('');
        console.log(`[SERVER] Warden Backend listening on http://localhost:${config.port}`);
        console.log(`[SERVER] API available at http://localhost:${config.port}/api`);
        console.log('');
    });
}

main().catch(err => {
    console.error('[FATAL]', err);
    process.exit(1);
});

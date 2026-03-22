require('dotenv').config()

const app = require('./src/app.cjs')
const { initDatabase } = require('./src/utils/initDb.js')

const PORT = process.env.PORT || 3000

let serverInstance;

const shutdown = (signal) => {
  console.log(`🛑 Received ${signal}, shutting down gracefully`);
  
  if (serverInstance) {
    serverInstance.close(async () => {
      console.log('Closed out remaining connections');
      try {
        const { pool } = require('./src/db.cjs');
        await pool.end();
        console.log('Database pool closed');
        process.exit(0);
      } catch (err) {
        console.error('Error during database pool closure:', err);
        process.exit(1);
      }
    });
  } else {
    process.exit(0);
  }

  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Initialize Database before starting server
initDatabase().then(() => {
  console.log('📦 Database Schema Verified')
  
  serverInstance = app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 THOUESA API is LIVE on port ' + PORT)
    console.log('🔒 CSP Manual Config Applied')
  })

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

}).catch(err => {
  console.error('❌ CRITICAL: Failed to initialize database. Server starting in degraded mode:', err.message);
  serverInstance = app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 THOUESA API is LIVE on port ' + PORT + ' (DB Offline)')
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // In production, you might want to shutdown
  // shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  shutdown('uncaughtException');
});

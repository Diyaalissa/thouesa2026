require('dotenv').config()
const compression = require('compression')

const app = require('./src/app.cjs')
const { initDatabase } = require('./src/utils/initDb.js')

app.use(compression())

const PORT = process.env.PORT || 3000

// Initialize Database before starting server
initDatabase().then(() => {
  console.log('📦 Database Schema Verified')
}).catch(err => {
  console.error('❌ Failed to initialize database (Server will still start, but DB features will fail):', err.message);
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('🚀 THOUESA API is LIVE on port ' + PORT)
  console.log('🔒 CSP Manual Config Applied')
})

// Graceful Shutdown
const shutdown = (signal) => {
  console.log(`🛑 Received ${signal}, shutting down gracefully`);
  
  // 1. Stop accepting new connections
  server.close(async () => {
    console.log('Closed out remaining connections');
    try {
      // 2. Close database pool
      const { pool } = require('./src/db.cjs');
      await pool.end();
      console.log('Database pool closed');
      process.exit(0);
    } catch (err) {
      console.error('Error during database pool closure:', err);
      process.exit(1);
    }
  });

  // Force close after 10s
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // In production, you might want to shutdown
  // shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  shutdown('uncaughtException');
});

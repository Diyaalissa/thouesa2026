const db = require('../src/db.cjs');
const logger = require('../src/utils/logger.js');

async function fixDatabase() {
  try {
    logger.info('Starting database cleanup and optimization...');
    
    // 1. Ensure all tables use utf8mb4_unicode_ci
    const dbName = process.env.DB_NAME || 'thoumaqd_thouesa';
    await db.query(`ALTER DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    
    const [tables] = await db.query(`SHOW TABLES FROM \`${dbName}\``);
    for (const row of tables) {
      const tableName = Object.values(row)[0];
      logger.info(`Optimizing table: ${tableName}`);
      await db.query(`ALTER TABLE \`${tableName}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    }

    // 2. Fix potential data inconsistencies
    // Example: Ensure all users have a customer_id
    const [usersWithoutId] = await db.query('SELECT id FROM users WHERE customer_id IS NULL');
    for (const user of usersWithoutId) {
      const shortId = user.id.substring(0, 8).toUpperCase();
      await db.query('UPDATE users SET customer_id = ? WHERE id = ?', [`CUST-${shortId}`, user.id]);
    }

    // 3. Clean up orphaned records (optional, be careful)
    // await db.query('DELETE FROM refresh_tokens WHERE user_id NOT IN (SELECT id FROM users)');

    logger.info('Database cleanup completed successfully.');
    process.exit(0);
  } catch (error) {
    logger.error('Database cleanup failed:', error);
    process.exit(1);
  }
}

fixDatabase();

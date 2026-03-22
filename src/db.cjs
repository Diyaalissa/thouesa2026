const mysql = require('mysql2/promise');

const hasCredentials = process.env.DB_USER && process.env.DB_NAME;

const poolConfig = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'thouesa',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

const pool = hasCredentials ? mysql.createPool(poolConfig) : {
  query: async () => { throw new Error('Database not configured. Please set DB_USER, DB_PASSWORD, and DB_NAME.'); },
  getConnection: async () => { throw new Error('Database not configured.'); },
  on: () => {}
};

const query = async (sql, params) => {
  try {
    if (!hasCredentials) throw new Error('Database not configured.');
    const [results] = await pool.query(sql, params);
    return results;
  } catch (error) {
    console.error('Database Query Error:', error.message);
    throw error;
  }
};

const getConnection = async () => {
  if (!hasCredentials) throw new Error('Database not configured.');
  return await pool.getConnection();
};

module.exports = { query, pool, getConnection, hasCredentials };

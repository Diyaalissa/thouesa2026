const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'thoumaqd_thouesa_u',
  password: process.env.DB_PASS || 'Diyaalissa1999',
  database: process.env.DB_NAME || 'thoumaqd_thouesa',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10, // Reduced for shared hosting stability
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  connectTimeout: 10000,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

const query = async (sql, params) => {
  try {
    const [results] = await pool.query(sql, params);
    return results;
  } catch (error) {
    console.error('Database Query Error:', error);
    throw error;
  }
};

const getConnection = async () => {
  return await pool.getConnection();
};

module.exports = { query, pool, getConnection };

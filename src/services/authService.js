const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { query, pool } = require('../db.cjs');
const logger = require('../utils/logger.js');
const appConfig = require('../config/appConfig.js');

const JWT_SECRET_RAW = process.env.JWT_SECRET;
const TOKEN_PEPPER_RAW = process.env.TOKEN_PEPPER;

if (process.env.NODE_ENV === 'production' && (!JWT_SECRET_RAW || !TOKEN_PEPPER_RAW)) {
  console.error('❌ CRITICAL: JWT_SECRET and TOKEN_PEPPER are REQUIRED in production mode.');
  process.exit(1);
}

const JWT_SECRET = JWT_SECRET_RAW || 'thouesa_dev_fallback_secret_12345';
const TOKEN_PEPPER = TOKEN_PEPPER_RAW || 'thouesa_dev_fallback_pepper_12345';

const normalizePhone = (phone) => {
  if (!phone) return null;
  // Remove all non-numeric characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If it already starts with 962 or 213, assume it's normalized
  if (cleaned.startsWith('962') && (cleaned.length === 12 || cleaned.length === 11)) {
    return cleaned;
  }
  if (cleaned.startsWith('213') && (cleaned.length === 12 || cleaned.length === 11)) {
    return cleaned;
  }

  // Jordan specific: 079... (10 digits) -> 96279...
  if (cleaned.startsWith('0') && cleaned.length === 10 && (cleaned[1] === '7' || cleaned[1] === '8' || cleaned[1] === '9')) {
    cleaned = '962' + cleaned.slice(1);
  }
  // Algeria specific: 05/06/07... (10 digits) -> 213...
  else if (cleaned.startsWith('0') && cleaned.length === 10 && (cleaned[1] === '5' || cleaned[1] === '6')) {
    cleaned = '213' + cleaned.slice(1);
  }
  // If it starts with 7, 8, 9 and is 9 digits (Jordan without leading 0)
  else if (cleaned.length === 9 && (cleaned[0] === '7' || cleaned[0] === '8' || cleaned[0] === '9')) {
    cleaned = '962' + cleaned;
  }
  // If it starts with 5, 6 and is 9 digits (Algeria without leading 0)
  else if (cleaned.length === 9 && (cleaned[0] === '5' || cleaned[0] === '6')) {
    cleaned = '213' + cleaned;
  }
  
  return cleaned;
};

exports.normalizePhone = normalizePhone;

const hashRefreshToken = (refreshToken) => crypto.createHash('sha256')
  .update(refreshToken + TOKEN_PEPPER)
  .digest('hex');

exports.hashRefreshToken = hashRefreshToken;

exports.createUser = async (userData) => {
  const { full_name, email, password, phone, role = 'customer' } = userData;
  const id = uuidv4();
  const customer_id = `CID-${Math.floor(1000 + Math.random() * 9000)}`;
  const hashedPassword = await bcrypt.hash(password, 12); // Increased cost to 12

  const normalizedPhone = normalizePhone(phone);

  const sql = 'INSERT INTO users (id, customer_id, full_name, email, password, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)';
  await query(sql, [id, customer_id, full_name, email || null, hashedPassword, normalizedPhone, role]);

  return { id, customer_id, full_name, email, phone: normalizedPhone, role };
};

exports.findUserByEmail = async (email) => {
  if (!email) return null;
  const sql = 'SELECT * FROM users WHERE email = ?';
  const results = await query(sql, [email]);
  console.log(`Query for email [${email}] returned ${results.length} results`);
  return results[0] || null;
};

exports.findUserByPhone = async (phone) => {
  if (!phone) return null;
  const normalized = normalizePhone(phone);
  const sql = 'SELECT * FROM users WHERE phone = ?';
  const results = await query(sql, [normalized]);
  return results[0] || null;
};

exports.findUserByIdentifier = async (identifier) => {
  if (!identifier) return null;
  
  // 1. Try Email first (Priority) with strict regex
  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  if (emailRegex.test(identifier)) {
    const user = await exports.findUserByEmail(identifier);
    if (user) return user;
  }

  // 2. Try Phone
  const normalized = normalizePhone(identifier);
  const user = await exports.findUserByPhone(normalized);
  if (user) return user;

  // 3. Fallback: raw identifier check on phone
  const results = await query('SELECT * FROM users WHERE phone = ? LIMIT 1', [identifier]);
  return results[0] || null;
};

exports.generateTokens = async (user, clientInfo = {}, txnConnection = null) => {
  const accessToken = jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      iat: Math.floor(Date.now() / 1000)
    },
    JWT_SECRET,
    { 
      expiresIn: appConfig.jwtExpire,
      issuer: 'thouesa-api'
    }
  );

  // High entropy refresh token (256-bit)
  const refreshToken = crypto.randomBytes(32).toString('hex');
  const hashedToken = hashRefreshToken(refreshToken);
  
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  // Stable session binding: Hash IP prefix + User Agent
  // Using prefix /24 for IPv4 or /48 for IPv6 to handle dynamic IPs in same network
  let ipPrefix = clientInfo.ip || 'unknown';
  if (ipPrefix.includes('.')) {
    ipPrefix = ipPrefix.split('.').slice(0, 3).join('.'); // 192.168.1.x
  } else if (ipPrefix.includes(':')) {
    ipPrefix = ipPrefix.split(':').slice(0, 3).join(':'); // IPv6 prefix
  }
  
  const clientFingerprint = crypto.createHash('sha256')
    .update(ipPrefix + (clientInfo.userAgent || ''))
    .digest('hex');

  const dbConn = txnConnection || pool;

  // Enforce max 5 refresh tokens per user - Optimized deletion
  const [currentTokens] = await dbConn.execute(
    'SELECT id FROM refresh_tokens WHERE user_id = ? ORDER BY created_at ASC', 
    [user.id]
  );
  
  if (currentTokens.length >= 5) {
    const tokensToDelete = currentTokens.slice(0, currentTokens.length - 4).map(t => t.id);
    await dbConn.query('DELETE FROM refresh_tokens WHERE id IN (?)', [tokensToDelete]);
  }

  const sql = 'INSERT INTO refresh_tokens (id, user_id, token, ip_hash, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?)';
  await dbConn.query(sql, [uuidv4(), user.id, hashedToken, clientFingerprint, clientInfo.userAgent || null, expiresAt]);

  return { accessToken, refreshToken };
};

exports.refreshAccessToken = async (oldRefreshToken, clientInfo = {}) => {
  const hashedToken = hashRefreshToken(oldRefreshToken);
  
  const connection = await pool.getConnection();
  try {
    // Ensure REPEATABLE READ or READ COMMITTED depending on DB config
    // MySQL default REPEATABLE READ is fine with the unique index on token
    await connection.beginTransaction();

    const checkSql = 'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > CURRENT_TIMESTAMP FOR UPDATE';
    const [results] = await connection.execute(checkSql, [hashedToken]);
    const tokenData = results[0];

    if (!tokenData) {
      await connection.rollback();
      return null;
    }

    // Timing safe comparison
    const dbTokenBuffer = Buffer.from(tokenData.token);
    const inputTokenBuffer = Buffer.from(hashedToken);
    if (dbTokenBuffer.length !== inputTokenBuffer.length || !crypto.timingSafeEqual(dbTokenBuffer, inputTokenBuffer)) {
      await connection.rollback();
      return null;
    }

    // Verify client fingerprint
    let ipPrefix = clientInfo.ip || 'unknown';
    if (ipPrefix.includes('.')) {
      ipPrefix = ipPrefix.split('.').slice(0, 3).join('.');
    } else if (ipPrefix.includes(':')) {
      ipPrefix = ipPrefix.split(':').slice(0, 3).join(':');
    }
    const clientFingerprint = crypto.createHash('sha256')
      .update(ipPrefix + (clientInfo.userAgent || ''))
      .digest('hex');

    if (tokenData.ip_hash !== clientFingerprint) {
      // Fingerprint mismatch - possible token theft
      // Instead of revoking ALL tokens, let's just invalidate this specific token
      // and log a warning. This is less disruptive for users with dynamic IPs.
      await connection.execute('DELETE FROM refresh_tokens WHERE id = ?', [tokenData.id]);
      await connection.commit();
      logger.warn(`Refresh token fingerprint mismatch for user ${tokenData.user_id}. Token revoked.`, {
        expected: tokenData.ip_hash,
        actual: clientFingerprint
      });
      return null;
    }

    // Delete old token atomically
    await connection.execute('DELETE FROM refresh_tokens WHERE id = ?', [tokenData.id]);

    const [userResults] = await connection.execute('SELECT * FROM users WHERE id = ?', [tokenData.user_id]);
    const user = userResults[0];

    if (!user) {
      await connection.rollback();
      return null;
    }

    // Generate new pair
    const tokens = await exports.generateTokens(user, clientInfo, connection);
    
    await connection.commit();
    return tokens;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

exports.comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

exports.revokeRefreshToken = async (refreshToken) => {
  if (!refreshToken) return false;
  const hashedToken = hashRefreshToken(refreshToken);
  const result = await query('DELETE FROM refresh_tokens WHERE token = ?', [hashedToken]);
  return result.affectedRows > 0;
};

exports.revokeUserRefreshTokens = async (userId) => {
  if (!userId) return false;
  const result = await query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  return result.affectedRows > 0;
};

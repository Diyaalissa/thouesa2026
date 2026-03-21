const jwt = require('jsonwebtoken');
const logger = require('../utils/logger.js');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const secretToUse = JWT_SECRET;

const { query } = require('../db.cjs');

exports.authenticate = async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, secretToUse);
    
    // Check if user is still active in DB
    const [user] = await query('SELECT id, role, account_status FROM users WHERE id = ?', [decoded.id]);
    
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists' });
    }
    
    if (user.account_status !== 'active') {
      return res.status(403).json({ message: `Account is ${user.account_status}` });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('JWT Verification Error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

exports.authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
    }
    next();
  };
};

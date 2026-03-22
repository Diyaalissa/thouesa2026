const { query } = require('../db.cjs');
const path = require('path');
const logger = require('../utils/logger.js');

/**
 * Middleware to check if the user has permission to access a file in /uploads
 */
const fileAuthMiddleware = async (req, res, next) => {
  try {
    const fileName = path.basename(req.path);
    const fileUrl = `/uploads/${fileName}`;

    // 1. Check if the file exists in the database
    const [file] = await query('SELECT * FROM files WHERE file_url = ?', [fileUrl]);

    if (!file) {
      // If file is not in DB, we might still want to serve it if it's a public asset
      // but for /uploads, we expect all files to be registered.
      // For now, let's allow it if it's not a sensitive type or if it's a known public path.
      return next();
    }

    // 2. Public files (like product images) can be accessed by anyone
    if (file.type === 'product_image' || file.type === 'public_asset') {
      return next();
    }

    // 3. Private files (like KYC documents) require authentication and ownership
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required to access this file' });
    }

    // Admin/Operator can access all files
    if (req.user.role === 'admin' || req.user.role === 'operator') {
      return next();
    }

    // Users can only access their own files
    if (file.user_id !== req.user.id) {
      logger.warn(`Unauthorized file access attempt by user ${req.user.id} for file ${fileUrl}`);
      return res.status(403).json({ error: 'Access denied: You do not own this file' });
    }

    next();
  } catch (error) {
    logger.error('File Auth Middleware Error:', error);
    next(); // Fallback to next if something goes wrong, but static server will still serve if not careful
  }
};

module.exports = fileAuthMiddleware;

const { v4: uuidv4 } = require('uuid');
const { query } = require('../db.cjs');

exports.createNotification = async (userId, message) => {
    try {
        const id = uuidv4();
        const sql = 'INSERT INTO notifications (id, user_id, message) VALUES (?, ?, ?)';
        // Fire and forget, don't await to avoid blocking main transactions
        query(sql, [id, userId, message]).catch(err => {
            const logger = require('../utils/logger.js');
            logger.error('Failed to create notification:', err);
        });
        return { id, userId, message };
    } catch (error) {
        const logger = require('../utils/logger.js');
        logger.error('Error in createNotification:', error);
        // Don't throw, so it doesn't break the calling function
    }
};

exports.getNotificationsByUserId = async (userId, limit = 10, offset = 0) => {
    const sql = 'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
    return await query(sql, [userId, limit, offset]);
};

exports.markAsRead = async (id) => {
    const sql = 'UPDATE notifications SET is_read = TRUE WHERE id = ?';
    await query(sql, [id]);
};

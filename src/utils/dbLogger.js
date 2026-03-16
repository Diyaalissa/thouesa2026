const { v4: uuidv4 } = require('uuid');
const { query } = require('../db.cjs');

exports.logAction = async (userId, action, details) => {
    const id = uuidv4();
    const sql = 'INSERT INTO logs (id, user_id, action, details) VALUES (?, ?, ?, ?)';
    await query(sql, [id, userId, action, JSON.stringify(details)]);
};

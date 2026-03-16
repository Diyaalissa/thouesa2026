const { query } = require('../db.cjs');

exports.getRecentLogs = async (limit = 50) => {
    const sql = `SELECT l.*, u.full_name as user_name 
                 FROM logs l 
                 LEFT JOIN users u ON l.user_id = u.id 
                 ORDER BY l.created_at DESC LIMIT ?`;
    return await query(sql, [limit]);
};

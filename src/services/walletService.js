const { v4: uuidv4 } = require('uuid');
const { query } = require('../db.cjs');

exports.getBalance = async (userId) => {
    const sql = `
        SELECT 
            COALESCE(SUM(CASE WHEN type IN ('deposit', 'refund') THEN amount ELSE -amount END), 0) as balance
        FROM transactions
        WHERE user_id = ?
    `;
    const results = await query(sql, [userId]);
    return results[0].balance;
};

exports.addTransaction = async (transactionData) => {
    const { user_id, amount, type, description } = transactionData;
    const id = uuidv4();

    const sql = 'INSERT INTO transactions (id, user_id, amount, type, description) VALUES (?, ?, ?, ?, ?)';
    await query(sql, [id, user_id, amount, type, description]);

    return { id, user_id, amount, type };
};

exports.getTransactionsByUserId = async (userId, limit = 20, offset = 0) => {
    const sql = 'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
    return await query(sql, [userId, limit, offset]);
};

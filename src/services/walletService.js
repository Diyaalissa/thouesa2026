const { v4: uuidv4 } = require('uuid');
const { query, getConnection } = require('../db.cjs');

exports.getBalance = async (userId) => {
    const [user] = await query('SELECT wallet_balance FROM users WHERE id = ?', [userId]);
    return user ? user.wallet_balance : 0;
};

exports.addTransaction = async (transactionData) => {
    const { user_id, amount, type, description, reference_id, reference_type } = transactionData;
    const connection = await getConnection();
    
    try {
        await connection.beginTransaction();
        
        const [user] = await connection.query('SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE', [user_id]);
        if (!user) throw new Error('User not found');
        
        const balanceBefore = user.wallet_balance;
        let balanceAfter;
        
        if (['deposit', 'refund', 'adjustment'].includes(type)) {
            balanceAfter = balanceBefore + parseFloat(amount);
        } else {
            balanceAfter = balanceBefore - parseFloat(amount);
        }
        
        const id = uuidv4();
        const sql = `INSERT INTO transactions 
                    (id, user_id, amount, balance_before, balance_after, type, description, reference_id, reference_type) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        await connection.query(sql, [id, user_id, amount, balanceBefore, balanceAfter, type, description, reference_id, reference_type]);
        await connection.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [balanceAfter, user_id]);
        
        await connection.commit();
        return { id, user_id, amount, type, balance_after: balanceAfter };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

exports.getTransactionsByUserId = async (userId, limit = 20, offset = 0) => {
    const sql = 'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
    return await query(sql, [userId, limit, offset]);
};

const { v4: uuidv4 } = require('uuid');
const { query } = require('../db.cjs');

exports.createPayment = async (paymentData) => {
    const { user_id, shipment_id, amount, method } = paymentData;
    const id = uuidv4();
    const sql = 'INSERT INTO payments (id, user_id, shipment_id, amount, method, status) VALUES (?, ?, ?, ?, ?, "completed")';
    await query(sql, [id, user_id, shipment_id, amount, method]);
    return { id, status: 'completed' };
};

exports.getPaymentsByUserId = async (userId) => {
    const sql = 'SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC';
    return await query(sql, [userId]);
};

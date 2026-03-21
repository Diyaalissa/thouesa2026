const { query } = require('../db.cjs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger.js');
const shipmentService = require('../services/shipmentService.js');
const { logAction } = require('../utils/auditLogger.js');

// Public Portal
exports.getSettings = async (req, res, next) => {
  try {
    const results = await query('SELECT * FROM settings ORDER BY id ASC LIMIT 1');
    let settings = results[0] || {};

    res.json({
      status: 'success',
      message: '',
      data: settings
    });
  } catch (error) {
    logger.error(error);
    next(error);
  }
};

exports.getTrips = async (req, res, next) => {
  try {
    const results = await query('SELECT * FROM trips ORDER BY trip_date ASC LIMIT 5');
    res.json({
      status: 'success',
      message: '',
      data: results
    });
  } catch (error) {
    next(error);
  }
};

exports.getReviews = async (req, res, next) => {
  try {
    const results = await query('SELECT * FROM reviews WHERE status = "displayed" ORDER BY created_at DESC LIMIT 10');
    res.json({
      status: 'success',
      message: '',
      data: results
    });
  } catch (error) {
    next(error);
  }
};

// Customer Portal
exports.getProfile = async (req, res, next) => {
  try {
    const results = await query('SELECT id, customer_id, full_name, email, phone, role, verification_status, verification_note, wallet_balance, last_login_at, account_status, country, city, kyc_status, kyc_document, kyc_verified_at, referral_code, referred_by FROM users WHERE id = ?', [req.user.id]);
    const user = results[0];
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found', data: null });
    
    res.json({
      status: 'success',
      message: '',
      data: {
        ...user,
        name: user.full_name
      }
    });
  } catch (error) {
    logger.error(error);
    next(error);
  }
};

exports.getOrders = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const offset = parseInt(req.query.offset) || 0;
    const results = await shipmentService.getShipmentsByUserId(req.user.id, limit, offset);
    res.json({
      status: 'success',
      message: '',
      data: results
    });
  } catch (error) {
    next(error);
  }
};

exports.createOrder = async (req, res, next) => {
  try {
    const { 
      type, address_id, delivery_method, items, 
      declared_value, product_image_url, origin_country, 
      destination_country, currency, customs_included,
      weight, length, width, height, package_type, priority,
      estimated_delivery, warehouse_id
    } = req.body;
    
    const result = await shipmentService.createShipment({
      user_id: req.user.id,
      type,
      address_id,
      delivery_method,
      items,
      declared_value,
      product_image_url,
      origin_country,
      destination_country,
      currency,
      customs_included,
      weight,
      length,
      width,
      height,
      package_type,
      priority,
      estimated_delivery,
      warehouse_id
    });
    
    await logAction(req.user.id, 'CREATE_ORDER', { orderId: result.id }, req, null, null, null, null, null, 'order', result.id);
    
    // Link product image to order in files table if it exists
    if (product_image_url) {
      await query('UPDATE files SET order_id = ? WHERE file_url = ? AND user_id = ? AND type = "product_image"', 
        [result.id, product_image_url, req.user.id]);
    }
    
    res.status(201).json({ 
      status: 'success',
      message: 'Order created successfully', 
      data: result 
    });
  } catch (error) {
    logger.error('Create Order Error:', error);
    next(error);
  }
};

exports.cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const order = await shipmentService.getShipmentById(id);
    
    if (!order || order.user_id !== req.user.id) return res.status(404).json({ status: 'error', message: 'Order not found', data: null });
    if (order.status !== 'pending') return res.status(400).json({ status: 'error', message: 'Cannot cancel order in this stage', data: null });
    
    const { reason } = req.body;
    const result = await shipmentService.updateShipment(id, { status: 'cancelled', cancellation_reason: reason || 'Cancelled by user' }, req.user.id);
    await logAction(req.user.id, 'CANCEL_ORDER', { orderId: id }, req, null, result.before, result.after, null, null, 'order', id);
    res.json({ 
      status: 'success',
      message: 'Order cancelled',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

exports.getAddresses = async (req, res, next) => {
  try {
    const results = await query('SELECT * FROM addresses WHERE user_id = ?', [req.user.id]);
    res.json({
      status: 'success',
      message: '',
      data: results
    });
  } catch (error) {
    next(error);
  }
};

exports.createAddress = async (req, res, next) => {
  try {
    const { name, phone, address } = req.body;
    const id = uuidv4();
    await query('INSERT INTO addresses (id, user_id, name, phone, address) VALUES (?, ?, ?, ?, ?)', [id, req.user.id, name, phone, address]);
    await logAction(req.user.id, 'CREATE_ADDRESS', { addressId: id }, req.ip);
    res.status(201).json({ 
      status: 'success',
      message: 'Address saved', 
      data: { id } 
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteAddress = async (req, res, next) => {
  try {
    await query('DELETE FROM addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    await logAction(req.user.id, 'DELETE_ADDRESS', { addressId: req.params.id }, req.ip);
    res.json({ 
      status: 'success',
      message: 'Address deleted',
      data: null
    });
  } catch (error) {
    next(error);
  }
};

exports.getTransactions = async (req, res, next) => {
  try {
    const results = await query('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({
      status: 'success',
      message: '',
      data: results
    });
  } catch (error) {
    next(error);
  }
};

exports.getPayments = async (req, res, next) => {
  try {
    const results = await query('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({
      status: 'success',
      message: '',
      data: results
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrderFiles = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const results = await query('SELECT * FROM files WHERE user_id = ? AND order_id = ? ORDER BY created_at DESC', [req.user.id, orderId]);
    res.json({
      status: 'success',
      message: '',
      data: results
    });
  } catch (error) {
    next(error);
  }
};

exports.getTickets = async (req, res, next) => {
  try {
    const results = await query('SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json({
      status: 'success',
      message: '',
      data: results
    });
  } catch (error) {
    next(error);
  }
};

exports.createTicket = async (req, res, next) => {
  try {
    const { subject, message } = req.body;
    const id = uuidv4();
    await query('INSERT INTO support_tickets (id, user_id, subject, message) VALUES (?, ?, ?, ?)', [id, req.user.id, subject, message]);
    res.status(201).json({ 
      status: 'success',
      message: 'Ticket sent', 
      data: { id } 
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadProductImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    }
    const filePath = `/uploads/${req.file.filename}`;
    const orderId = req.body.order_id || req.query.order_id || null;
    
    // Register in files table
    const fileId = uuidv4();
    await query('INSERT INTO files (id, user_id, order_id, type, file_url) VALUES (?, ?, ?, ?, ?)', 
      [fileId, req.user.id, orderId, 'product_image', filePath]);

    res.json({ 
      status: 'success',
      message: 'Product image uploaded',
      data: { filePath } 
    });
  } catch (error) {
    next(error);
  }
};

exports.uploadIdImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ status: 'error', message: 'No file uploaded' });
    }
    const filePath = `/uploads/${req.file.filename}`;
    
    // Register in files table
    const fileId = uuidv4();
    await query('INSERT INTO files (id, user_id, order_id, type, file_url) VALUES (?, ?, ?, ?, ?)', 
      [fileId, req.user.id, null, 'kyc_document', filePath]);

    await query('UPDATE users SET kyc_document = ?, kyc_status = "pending" WHERE id = ?', [filePath, req.user.id]);
    res.json({ 
      status: 'success',
      message: 'ID uploaded', 
      data: { filePath } 
    });
  } catch (error) {
    next(error);
  }
};

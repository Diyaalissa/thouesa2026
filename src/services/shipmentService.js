const { v4: uuidv4 } = require('uuid');
const { query, getConnection } = require('../db.cjs');

exports.createShipment = async (shipmentData) => {
    const { 
        user_id, type, address_id, delivery_method, items, 
        declared_value, product_image_url, origin_country, 
        destination_country, currency, customs_included,
        weight, length, width, height, package_type, priority,
        estimated_delivery, warehouse_id
    } = shipmentData;

    if (!type || !address_id) {
        throw new Error("Missing shipment fields");
    }

    // Security: Verify address ownership
    const [address] = await query('SELECT id FROM addresses WHERE id = ? AND user_id = ?', [address_id, user_id]);
    if (!address) {
        throw new Error("Invalid address ID or address does not belong to user");
    }

    const id = uuidv4();
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const serial_number = `TH-${dateStr}-${randomStr}`;
    const connection = await getConnection();

    try {
        await connection.beginTransaction();

        const sql = `INSERT INTO orders (
                        id, user_id, serial_number, type, address_id, 
                        delivery_method, items, declared_value, product_image_url,
                        origin_country, destination_country, currency, customs_included,
                        weight, length, width, height, package_type, priority,
                        estimated_delivery, warehouse_id
                     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        
        await connection.query(sql, [
            id, user_id, serial_number, type, address_id, 
            delivery_method, typeof items === 'object' ? JSON.stringify(items) : items, declared_value, product_image_url,
            origin_country, destination_country, currency, customs_included,
            weight || 0.00, length || 0.00, width || 0.00, height || 0.00, package_type, priority || 'normal',
            estimated_delivery, warehouse_id
        ]);

        // Insert into order_status_history
        const historyId = uuidv4();
        await connection.query(
            'INSERT INTO order_status_history (id, order_id, status, changed_by, notes) VALUES (?, ?, ?, ?, ?)',
            [historyId, id, 'pending', user_id, 'Order created']
        );

        // Insert into order_items if items exist and is an array
        let parsedItems = items;
        if (typeof items === 'string') {
            try { parsedItems = JSON.parse(items); } catch (e) {}
        }
        
        if (Array.isArray(parsedItems)) {
            if (parsedItems.length > 50) {
                throw new Error("Maximum 50 items allowed per order");
            }
            for (const item of parsedItems) {
                if (!item.description || !item.quantity || item.quantity <= 0 || (item.price !== undefined && (!Number.isFinite(item.price) || item.price < 0))) {
                    throw new Error("Invalid item data: description, positive quantity, and non-negative price are required");
                }
                const itemId = uuidv4();
                await connection.query(
                    'INSERT INTO order_items (id, order_id, description, quantity, price) VALUES (?, ?, ?, ?, ?)',
                    [itemId, id, item.description, item.quantity, item.price || 0.00]
                );
            }
        }

        await connection.commit();

        // Link product image to files table if exists
        if (product_image_url) {
            try {
                await query('UPDATE files SET order_id = ? WHERE file_url = ? AND user_id = ? AND order_id IS NULL',
                    [id, product_image_url, user_id]);
            } catch (e) {
                console.error('Error linking file to order:', e);
            }
        }

        return { id, serial_number };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

exports.getShipmentsByUserId = async (userId, limit = 10, offset = 0) => {
    const sql = `SELECT s.*, a.address as shipping_address, a.phone as shipping_phone 
                 FROM orders s 
                 LEFT JOIN addresses a ON s.address_id = a.id AND a.user_id = s.user_id
                 WHERE s.user_id = ? 
                 ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
    return await query(sql, [userId, limit, offset]);
};

exports.getAllShipments = async (limit = 10, offset = 0) => {
    const sql = `SELECT s.*, u.full_name, u.email as user_email 
                 FROM orders s 
                 LEFT JOIN users u ON s.user_id = u.id 
                 ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
    return await query(sql, [limit, offset]);
};

const ALLOWED_TRANSITIONS = {
    'pending': ['approved', 'rejected', 'awaiting_payment', 'cancelled'],
    'approved': ['in_progress', 'rejected', 'awaiting_payment', 'cancelled'],
    'awaiting_payment': ['approved', 'in_progress', 'rejected', 'cancelled'],
    'in_progress': ['completed', 'rejected'],
    'rejected': [],
    'completed': [],
    'cancelled': []
};

exports.updateShipment = async (id, updateData, changedByUserId = null) => {
    const fields = [];
    const values = [];
    
    const allowedFields = [
        'status',
        'tracking_number',
        'declared_value',
        'type',
        'address_id',
        'items',
        'currency',
        'shipping_fees',
        'customs_fees',
        'insurance_amount',
        'local_delivery_fees',
        'tax_value',
        'final_price',
        'rejection_reason',
        'cancellation_reason',
        'weight',
        'length',
        'width',
        'height',
        'package_type',
        'priority',
        'estimated_delivery',
        'delivered_at',
        'warehouse_id',
        'operator_id',
        'payment_status'
    ];
    
    let newStatus = null;

    for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined && allowedFields.includes(key)) {
            // Basic validation for financial fields
            if (['shipping_fees', 'customs_fees', 'insurance_amount', 'local_delivery_fees', 'tax_value', 'final_price', 'declared_value'].includes(key)) {
                if (!Number.isFinite(value) || value < 0) {
                    throw new Error(`${key} must be a valid non-negative number`);
                }
            }
            
            fields.push(`${key} = ?`);
            // Ensure items are stringified if they are an object
            if (key === 'items' && typeof value === 'object') {
                values.push(JSON.stringify(value));
            } else {
                values.push(value);
            }

            if (key === 'status') {
                newStatus = value;
                // Set timestamps based on status
                if (newStatus === 'approved') {
                    fields.push('approved_at = ?');
                    values.push(new Date());
                } else if (newStatus === 'in_progress') {
                    fields.push('shipped_at = ?');
                    values.push(new Date());
                } else if (newStatus === 'completed') {
                    fields.push('delivered_at = ?');
                    values.push(new Date());
                } else if (newStatus === 'rejected' || newStatus === 'cancelled') {
                    fields.push('cancelled_at = ?');
                    values.push(new Date());
                }
            }
            
            // Calculate volumetric weight if dimensions are provided
            if (key === 'length' || key === 'width' || key === 'height') {
                const l = key === 'length' ? value : (updateData.length || 0);
                const w = key === 'width' ? value : (updateData.width || 0);
                const h = key === 'height' ? value : (updateData.height || 0);
                if (l && w && h) {
                    const volWeight = (parseFloat(l) * parseFloat(w) * parseFloat(h)) / 5000;
                    fields.push('volumetric_weight = ?');
                    values.push(volWeight);
                }
            }
        }
    }
    
    if (fields.length === 0) return;
    
    const connection = await getConnection();
    try {
        await connection.beginTransaction();

        // 1. Get current status, user_id, and final_price if we are changing it
        let orderUserId = null;
        let currentFinalPrice = 0;
        let beforeState = null;
        
        const [currentOrder] = await connection.query('SELECT * FROM orders WHERE id = ? FOR UPDATE', [id]);
        if (!currentOrder) throw new Error('Order not found');
        
        const currentVersion = currentOrder.version || 1;
        beforeState = { ...currentOrder };
        const currentStatus = currentOrder.status;

        // Security: Prevent any updates to a completed order
        if (currentStatus === 'completed') {
            throw new Error('Cannot update a completed order');
        }

        orderUserId = currentOrder.user_id;
        currentFinalPrice = currentOrder.final_price;
        
        if (newStatus && currentStatus !== newStatus) {
            const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
            if (!allowed.includes(newStatus)) {
                throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
            }
        }

        // 2. Update the order
        // Security: When completing, we use the price from DB to prevent request tampering
        const deductionPrice = currentFinalPrice;
        
        fields.push('version = version + 1');
        
        const sql = `UPDATE orders SET ${fields.join(', ')} WHERE id = ? AND version = ?`;
        values.push(id);
        values.push(currentVersion);
        const [updateResult] = await connection.query(sql, values);
        
        if (updateResult.affectedRows === 0) {
            throw new Error('Order was updated by another process. Please refresh and try again.');
        }
        
        // 2.1 Update order_items table if items are provided as an array
        if (updateData.items && Array.isArray(updateData.items)) {
            if (updateData.items.length > 50) {
                throw new Error("Maximum 50 items allowed per order");
            }
            // Delete existing items first
            await connection.query('DELETE FROM order_items WHERE order_id = ?', [id]);
            
            // Insert new items
            for (const item of updateData.items) {
                if (!item.description || !item.quantity || item.quantity <= 0 || (item.price !== undefined && (!Number.isFinite(item.price) || item.price < 0))) {
                    throw new Error("Invalid item data: description, positive quantity, and non-negative price are required");
                }
                const itemId = uuidv4();
                await connection.query(
                    'INSERT INTO order_items (id, order_id, description, quantity, price) VALUES (?, ?, ?, ?, ?)',
                    [itemId, id, item.description, item.quantity, item.price || 0.00]
                );
            }
        }
        
        // 3. If status changed, record in history and handle side effects
        if (newStatus) {
            const historyId = uuidv4();
            const statusNotes = updateData.rejection_reason || updateData.cancellation_reason || `Status changed to ${newStatus}`;
            await connection.query(
                'INSERT INTO order_status_history (id, order_id, status, changed_by, notes) VALUES (?, ?, ?, ?, ?)',
                [historyId, id, newStatus, changedByUserId, statusNotes]
            );

            // 4. Wallet Deduction if status is 'completed'
            if (newStatus === 'completed' && deductionPrice > 0) {
                const [user] = await connection.query('SELECT wallet_balance FROM users WHERE id = ? FOR UPDATE', [orderUserId]);
                if (!user) throw new Error('User not found for wallet deduction');
                
                if (user.wallet_balance < deductionPrice) {
                    throw new Error('Insufficient wallet balance to complete order');
                }

                const balanceBefore = user.wallet_balance;
                const balanceAfter = balanceBefore - deductionPrice;

                await connection.query('UPDATE users SET wallet_balance = ? WHERE id = ?', [balanceAfter, orderUserId]);
                
                // Log transaction with reference to prevent double payment
                const tid = uuidv4();
                await connection.query(
                    'INSERT INTO transactions (id, user_id, amount, balance_before, balance_after, type, description, reference_id, reference_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [tid, orderUserId, -deductionPrice, balanceBefore, balanceAfter, 'payment', `Payment for order ${id}`, id, 'order']
                );

                // Also record in payments table
                const pid = uuidv4();
                await connection.query(
                    'INSERT INTO payments (id, user_id, shipment_id, amount, method, status) VALUES (?, ?, ?, ?, ?, ?)',
                    [pid, orderUserId, id, deductionPrice, 'wallet', 'completed']
                );
            }
        }
        
        const [afterOrder] = await connection.query('SELECT * FROM orders WHERE id = ?', [id]);
        const afterState = { ...afterOrder };

        await connection.commit();

        // 5. Create Notification (Outside transaction as it's non-critical)
        if (newStatus) {
            try {
                const notificationId = uuidv4();
                const message = `تم تحديث حالة طلبك إلى: ${newStatus}`;
                await query(
                    'INSERT INTO notifications (id, user_id, title, message) VALUES (?, ?, ?, ?)',
                    [notificationId, orderUserId, 'تحديث حالة الطلب', message]
                );
            } catch (notifError) {
                console.error('Failed to create notification:', notifError);
                // Don't throw, as the main transaction succeeded
            }
        }

        return { before: beforeState, after: afterState, orderUserId };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

exports.getShipmentById = async (id) => {
    const sql = 'SELECT * FROM orders WHERE id = ?';
    const results = await query(sql, [id]);
    return results[0];
};

const { query } = require('../db.cjs');
const { v4: uuidv4 } = require('uuid');

class ShipmentTrackingService {
  constructor() {
    this.validTransitions = {
      'CREATED': ['ARRIVED_WAREHOUSE', 'PROCESSING', 'CANCELLED'],
      'ARRIVED_WAREHOUSE': ['PROCESSING', 'IN_TRANSIT', 'CANCELLED'],
      'PROCESSING': ['IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'CANCELLED'],
      'IN_TRANSIT': ['CUSTOMS_CLEARANCE', 'OUT_FOR_DELIVERY', 'RETURNED', 'CANCELLED'],
      'CUSTOMS_CLEARANCE': ['OUT_FOR_DELIVERY', 'IN_TRANSIT', 'RETURNED', 'CANCELLED'],
      'OUT_FOR_DELIVERY': ['DELIVERED', 'RETURNED', 'CANCELLED'],
      'DELIVERED': [],
      'RETURNED': ['ARRIVED_WAREHOUSE', 'CANCELLED'],
      'CANCELLED': []
    };
  }

  async addEvent(orderId, status, location, description, createdBy = null) {
    const id = uuidv4();
    
    // Get order tracking number
    const [order] = await query('SELECT tracking_number, status as current_status FROM orders WHERE id = ?', [orderId]);
    if (!order) throw new Error('Order not found');

    // Optional: Validate transition if we had a strict mapping between order status and tracking events
    // For now, tracking events are more granular.

    await query(
      'INSERT INTO shipment_tracking_events (id, order_id, tracking_number, status, location, description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, orderId, order.tracking_number, status, location, description, createdBy]
    );

    // Update order status based on tracking event if applicable
    const statusMap = {
      'DELIVERED': 'completed',
      'CANCELLED': 'rejected' // or 'cancelled' if we added it
    };

    if (statusMap[status]) {
      const updateFields = { status: statusMap[status] };
      if (status === 'DELIVERED') updateFields.delivered_at = new Date();
      if (status === 'CANCELLED') updateFields.cancelled_at = new Date();
      
      const setClause = Object.keys(updateFields).map(k => `${k} = ?`).join(', ');
      await query(`UPDATE orders SET ${setClause} WHERE id = ?`, [...Object.values(updateFields), orderId]);
    }

    return id;
  }

  async getEventsByOrder(orderId) {
    return await query(
      'SELECT * FROM shipment_tracking_events WHERE order_id = ? ORDER BY event_time DESC',
      [orderId]
    );
  }

  async getEventsByNumber(trackingNumber) {
    return await query(
      'SELECT * FROM shipment_tracking_events WHERE tracking_number = ? ORDER BY event_time DESC',
      [trackingNumber]
    );
  }

  async deleteEvent(eventId) {
    await query('DELETE FROM shipment_tracking_events WHERE id = ?', [eventId]);
  }

  validateTransition(currentStatus, nextStatus) {
    if (!this.validTransitions[currentStatus]) return true; // If unknown, allow for flexibility
    return this.validTransitions[currentStatus].includes(nextStatus);
  }
}

module.exports = new ShipmentTrackingService();

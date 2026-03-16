const { query } = require('../db.cjs');
const { v4: uuidv4 } = require('uuid');

class ShippingRateService {
  calculateVolumetricWeight(length, width, height) {
    // Standard formula: (L x W x H) / 5000
    return (length * width * height) / 5000;
  }

  async calculateShippingCost(origin, destination, weight, dimensions = null, priority = 'normal', carrierId = null) {
    let actualWeight = weight;
    let volumetricWeight = 0;
    if (dimensions && dimensions.length && dimensions.width && dimensions.height) {
      volumetricWeight = this.calculateVolumetricWeight(dimensions.length, dimensions.width, dimensions.height);
      actualWeight = Math.max(weight, volumetricWeight);
    }

    // Find applicable rate
    let queryStr = `
      SELECT * FROM shipping_rates 
      WHERE origin_country = ? AND destination_country = ? 
      AND min_weight <= ? AND max_weight >= ?
      AND is_active = TRUE
    `;
    const params = [origin, destination, actualWeight, actualWeight];

    if (carrierId) {
      queryStr += ' AND carrier_id = ?';
      params.push(carrierId);
    }

    queryStr += ' ORDER BY price_per_kg ASC LIMIT 1';

    const rates = await query(queryStr, params);

    if (rates.length === 0) {
      throw new Error(`No shipping rate found for ${origin} to ${destination} at ${actualWeight}kg`);
    }

    const rate = rates[0];
    let cost = parseFloat(rate.base_price) + (actualWeight * parseFloat(rate.price_per_kg));
    
    if (priority === 'express') {
      cost *= parseFloat(rate.priority_multiplier || 1.5);
    }

    return {
      cost: parseFloat(cost.toFixed(2)),
      rateId: rate.id,
      actualWeight,
      volumetricWeight,
      carrierId: rate.carrier_id
    };
  }

  async getAllRates() {
    return await query('SELECT r.*, c.name as carrier_name FROM shipping_rates r LEFT JOIN carriers c ON r.carrier_id = c.id ORDER BY r.created_at DESC');
  }

  async createRate(data) {
    const id = uuidv4();
    const { origin_country, destination_country, base_price, price_per_kg, min_weight, max_weight, priority_multiplier, carrier_id } = data;
    await query(
      `INSERT INTO shipping_rates 
      (id, origin_country, destination_country, base_price, price_per_kg, min_weight, max_weight, priority_multiplier, carrier_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, origin_country, destination_country, base_price, price_per_kg, min_weight || 0, max_weight || 9999.99, priority_multiplier || 1.0, carrier_id]
    );
    return id;
  }

  async updateRate(id, data) {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      if (['origin_country', 'destination_country', 'base_price', 'price_per_kg', 'min_weight', 'max_weight', 'priority_multiplier', 'carrier_id', 'is_active'].includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (fields.length === 0) return;
    values.push(id);
    await query(`UPDATE shipping_rates SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async deleteRate(id) {
    await query('DELETE FROM shipping_rates WHERE id = ?', [id]);
  }
}

module.exports = new ShippingRateService();

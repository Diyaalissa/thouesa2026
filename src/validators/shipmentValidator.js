const { z } = require('zod');

exports.createShipmentSchema = z.object({
  type: z.enum(['parcel', 'buy', 'global']),
  address_id: z.string().uuid(),
  delivery_method: z.string().min(2),
  items: z.union([
    z.string().min(2),
    z.array(z.object({
      description: z.string().min(1),
      quantity: z.number().int().min(1),
      price: z.number().min(0).optional()
    }))
  ]),
  declared_value: z.number().min(0),
  insurance_enabled: z.boolean().optional(),
  product_image_url: z.string().nullable().optional().or(z.literal('')),
  origin_country: z.string().optional(),
  destination_country: z.string().optional(),
  currency: z.string().optional(),
  customs_included: z.boolean().optional(),
  weight: z.number().min(0).optional(),
  length: z.number().min(0).optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  package_type: z.string().optional(),
  priority: z.enum(['normal', 'express']).optional(),
  estimated_delivery: z.string().optional(),
  warehouse_id: z.string().uuid().optional()
}).strict();

exports.updateShipmentSchema = z.object({
  status: z.enum(['pending', 'approved', 'awaiting_payment', 'in_progress', 'completed', 'rejected', 'cancelled']).optional(),
  shipping_fees: z.number().min(0).optional(),
  customs_fees: z.number().min(0).optional(),
  insurance_amount: z.number().min(0).optional(),
  local_delivery_fees: z.number().min(0).optional(),
  tax_value: z.number().min(0).optional(),
  final_price: z.number().min(0).optional(),
  reason: z.string().optional(),
  rejection_reason: z.string().optional(),
  cancellation_reason: z.string().optional(),
  tracking_number: z.string().optional(),
  weight: z.number().min(0).optional(),
  length: z.number().min(0).optional(),
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  package_type: z.string().optional(),
  priority: z.enum(['normal', 'express']).optional(),
  estimated_delivery: z.string().nullable().optional(),
  delivered_at: z.string().nullable().optional(),
  warehouse_id: z.string().uuid().nullable().optional(),
  operator_id: z.string().uuid().nullable().optional(),
  payment_status: z.enum(['unpaid', 'paid', 'partially_paid']).optional()
}).strict();

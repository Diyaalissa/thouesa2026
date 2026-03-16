const { z } = require('zod');

exports.registerSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().min(8, 'Phone must be at least 8 characters')
}).strict();

exports.loginSchema = z.object({
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional(),
  password: z.string().min(1, 'Password is required')
}).strict().refine(data => data.email || data.phone, {
  message: "Either email or phone is required",
  path: ["email"]
});

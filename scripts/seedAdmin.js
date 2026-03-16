const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query, pool } = require('../src/db.cjs');

async function seedAdmin() {
  try {
    const email = 'admin@thouesa.com';
    const password = 'adminPassword123';
    const phone = '962790000000'; // Default Jordan format
    const name = 'مدير النظام';

    const existing = await query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      console.log('Admin user already exists.');
      process.exit(0);
    }

    const id = uuidv4();
    const customer_id = 'ADM-001';
    const hashedPassword = await bcrypt.hash(password, 12);

    await query(
      'INSERT INTO users (id, customer_id, full_name, email, password, phone, role, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, customer_id, name, email, hashedPassword, phone, 'admin', 'verified']
    );

    console.log('Admin user created successfully!');
    console.log('Email:', email);
    console.log('Password:', password);
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed admin:', error);
    process.exit(1);
  }
}

seedAdmin();

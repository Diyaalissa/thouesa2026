require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { query, pool } = require('../src/db.cjs');

async function seedAdmin() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPass = process.env.ADMIN_PASS;
    
    if (!adminEmail || !adminPass) {
      console.error('❌ Error: ADMIN_EMAIL and ADMIN_PASS must be set in .env');
      await pool.end();
      process.exit(1);
    }
    
    const existing = await query('SELECT id FROM users WHERE email = ?', [adminEmail]);
    if (existing.length === 0) {
      const id = uuidv4();
      const hashedPassword = await bcrypt.hash(adminPass, 12);
      await query(
        'INSERT INTO users (id, customer_id, full_name, email, password, phone, role, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, 'ADM-001', 'مدير النظام', adminEmail, hashedPassword, '962790000000', 'admin', 'verified']
      );
      console.log('✅ Default admin user created: ' + adminEmail);
    } else {
      console.log('ℹ️ Admin user already exists.');
    }
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('❌ Error seeding admin user:', e);
    await pool.end();
    process.exit(1);
  }
}

seedAdmin();

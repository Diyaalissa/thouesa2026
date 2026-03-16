const db = require('../db.cjs');
const { SCHEMA } = require('../models/schema.js');
const logger = require('./logger.js');

exports.initDatabase = async () => {
  try {
    logger.info('Initializing database schema...');
    
    // Ensure database uses utf8mb4
    const dbName = process.env.DB_NAME || 'thoumaqd_thouesa';
    await db.query(`ALTER DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);

    // Disable foreign key checks
    await db.query('SET FOREIGN_KEY_CHECKS = 0');

    // Split schema by semicolon and execute each statement
    const statements = SCHEMA.split(';').filter(s => s.trim() !== '');
    for (const statement of statements) {
      await db.query(statement);
    }

    // Force existing tables to utf8mb4 and CHAR(36) for IDs
    const tables = ['users', 'addresses', 'orders', 'payments', 'wallet_transactions', 'notifications', 'logs', 'refresh_tokens', 'settings'];
    for (const table of tables) {
      try {
        await db.query(`ALTER TABLE \`${table}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        // Ensure ID is CHAR(36)
        await db.query(`ALTER TABLE \`${table}\` MODIFY COLUMN id CHAR(36) NOT NULL`);
      } catch (e) {
        // Table might not exist yet or column might differ
      }
    }

    // Re-enable foreign key checks
    await db.query('SET FOREIGN_KEY_CHECKS = 1');

    // Add new columns to orders table if they don't exist
    try {
      const userCols = await db.query('SHOW COLUMNS FROM users');
      const userColNames = userCols.map(c => c.Field);
      if (!userColNames.includes('last_login_at')) await db.query('ALTER TABLE users ADD COLUMN last_login_at DATETIME AFTER wallet_balance');
      if (!userColNames.includes('last_login_ip')) await db.query('ALTER TABLE users ADD COLUMN last_login_ip VARCHAR(45) AFTER last_login_at');
      if (!userColNames.includes('account_status')) await db.query("ALTER TABLE users ADD COLUMN account_status ENUM('active', 'suspended', 'deleted') DEFAULT 'active' AFTER last_login_ip");
      if (!userColNames.includes('country')) await db.query('ALTER TABLE users ADD COLUMN country VARCHAR(50) AFTER account_status');
      if (!userColNames.includes('city')) await db.query('ALTER TABLE users ADD COLUMN city VARCHAR(50) AFTER country');
      if (!userColNames.includes('kyc_status')) await db.query("ALTER TABLE users ADD COLUMN kyc_status ENUM('none', 'pending', 'verified', 'rejected') DEFAULT 'none' AFTER city");
      if (!userColNames.includes('kyc_document')) await db.query('ALTER TABLE users ADD COLUMN kyc_document TEXT AFTER kyc_status');
      if (!userColNames.includes('kyc_verified_at')) await db.query('ALTER TABLE users ADD COLUMN kyc_verified_at DATETIME AFTER kyc_document');
      if (!userColNames.includes('referral_code')) await db.query('ALTER TABLE users ADD COLUMN referral_code VARCHAR(20) UNIQUE AFTER kyc_verified_at');
      if (!userColNames.includes('referred_by')) await db.query('ALTER TABLE users ADD COLUMN referred_by CHAR(36) AFTER referral_code');

      const columns = await db.query('SHOW COLUMNS FROM orders');
      const columnNames = columns.map(c => c.Field);
      
      if (!columnNames.includes('origin_country')) {
        await db.query('ALTER TABLE orders ADD COLUMN origin_country VARCHAR(50)');
      }
      if (!columnNames.includes('destination_country')) {
        await db.query('ALTER TABLE orders ADD COLUMN destination_country VARCHAR(50)');
      }
      if (!columnNames.includes('currency')) {
        await db.query('ALTER TABLE orders ADD COLUMN currency VARCHAR(10)');
      }
      if (!columnNames.includes('customs_included')) {
        await db.query('ALTER TABLE orders ADD COLUMN customs_included BOOLEAN DEFAULT TRUE');
      }
      if (!columnNames.includes('tracking_number')) {
        await db.query('ALTER TABLE orders ADD COLUMN tracking_number VARCHAR(100)');
      }
      if (!columnNames.includes('weight')) await db.query('ALTER TABLE orders ADD COLUMN weight DECIMAL(10, 2) DEFAULT 0.00');
      if (!columnNames.includes('length')) await db.query('ALTER TABLE orders ADD COLUMN length DECIMAL(10, 2) DEFAULT 0.00');
      if (!columnNames.includes('width')) await db.query('ALTER TABLE orders ADD COLUMN width DECIMAL(10, 2) DEFAULT 0.00');
      if (!columnNames.includes('height')) await db.query('ALTER TABLE orders ADD COLUMN height DECIMAL(10, 2) DEFAULT 0.00');
      if (!columnNames.includes('package_type')) await db.query('ALTER TABLE orders ADD COLUMN package_type VARCHAR(50)');
      if (!columnNames.includes('priority')) await db.query("ALTER TABLE orders ADD COLUMN priority ENUM('normal', 'express') DEFAULT 'normal'");
      if (!columnNames.includes('estimated_delivery')) await db.query('ALTER TABLE orders ADD COLUMN estimated_delivery DATE');
      if (!columnNames.includes('delivered_at')) await db.query('ALTER TABLE orders ADD COLUMN delivered_at DATETIME');
      if (!columnNames.includes('warehouse_id')) await db.query('ALTER TABLE orders ADD COLUMN warehouse_id CHAR(36)');
      if (!columnNames.includes('operator_id')) await db.query('ALTER TABLE orders ADD COLUMN operator_id CHAR(36)');
      if (!columnNames.includes('payment_status')) await db.query("ALTER TABLE orders ADD COLUMN payment_status ENUM('unpaid', 'paid', 'partially_paid') DEFAULT 'unpaid'");
      
      // Update ENUM to include awaiting_payment
      await db.query("ALTER TABLE orders MODIFY COLUMN status ENUM('pending', 'approved', 'awaiting_payment', 'in_progress', 'completed', 'rejected') DEFAULT 'pending'");

      // Financial precision and constraints
      try {
        await db.query('ALTER TABLE users MODIFY COLUMN wallet_balance DECIMAL(18, 2) NOT NULL DEFAULT 0.00');
        try { await db.query('ALTER TABLE users ADD CONSTRAINT chk_wallet_positive CHECK (wallet_balance >= 0)'); } catch (e) {}
        
        await db.query('ALTER TABLE orders MODIFY COLUMN declared_value DECIMAL(18, 2) NOT NULL DEFAULT 0.00');
        await db.query('ALTER TABLE orders MODIFY COLUMN shipping_fees DECIMAL(18, 2) NOT NULL DEFAULT 0.00');
        await db.query('ALTER TABLE orders MODIFY COLUMN customs_fees DECIMAL(18, 2) NOT NULL DEFAULT 0.00');
        await db.query('ALTER TABLE orders MODIFY COLUMN insurance_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00');
        await db.query('ALTER TABLE orders MODIFY COLUMN local_delivery_fees DECIMAL(18, 2) NOT NULL DEFAULT 0.00');
        await db.query('ALTER TABLE orders MODIFY COLUMN tax_value DECIMAL(18, 2) NOT NULL DEFAULT 0.00');
        await db.query('ALTER TABLE orders MODIFY COLUMN final_price DECIMAL(18, 2) NOT NULL DEFAULT 0.00');
        
        try { await db.query('ALTER TABLE orders ADD CONSTRAINT chk_final_price_positive CHECK (final_price >= 0)'); } catch (e) {}
        try { await db.query('ALTER TABLE orders ADD CONSTRAINT chk_declared_value_positive CHECK (declared_value >= 0)'); } catch (e) {}
        try { await db.query('ALTER TABLE orders ADD CONSTRAINT chk_shipping_fees_positive CHECK (shipping_fees >= 0)'); } catch (e) {}
        try { await db.query('ALTER TABLE orders ADD CONSTRAINT chk_customs_fees_positive CHECK (customs_fees >= 0)'); } catch (e) {}
        try { await db.query('ALTER TABLE orders ADD CONSTRAINT chk_insurance_amount_positive CHECK (insurance_amount >= 0)'); } catch (e) {}
        try { await db.query('ALTER TABLE orders ADD CONSTRAINT chk_local_delivery_fees_positive CHECK (local_delivery_fees >= 0)'); } catch (e) {}
        try { await db.query('ALTER TABLE orders ADD CONSTRAINT chk_tax_value_positive CHECK (tax_value >= 0)'); } catch (e) {}
        
        if (!columnNames.includes('version')) {
          await db.query('ALTER TABLE orders ADD COLUMN version INT DEFAULT 1 AFTER payment_status');
        }

        await db.query('ALTER TABLE order_items MODIFY COLUMN price DECIMAL(18, 2) NOT NULL DEFAULT 0.00');
        try { await db.query('ALTER TABLE order_items ADD CONSTRAINT chk_item_price_positive CHECK (price >= 0)'); } catch (e) {}
        
        await db.query('ALTER TABLE payments MODIFY COLUMN amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00');
        try { await db.query('ALTER TABLE payments ADD CONSTRAINT chk_payment_amount_positive CHECK (amount >= 0)'); } catch (e) {}
      } catch (e) { logger.error('Error during financial precision migration:', e); }

      // Add title to notifications if missing
      try {
        const notifCols = await db.query('SHOW COLUMNS FROM notifications');
        const notifColNames = notifCols.map(c => c.Field);
        if (!notifColNames.includes('title')) {
          await db.query('ALTER TABLE notifications ADD COLUMN title VARCHAR(255) AFTER user_id');
        }
      } catch (e) { /* Table might not exist yet */ }

      // Add reference fields to transactions if missing
      try {
        const transCols = await db.query('SHOW COLUMNS FROM transactions');
        const transColNames = transCols.map(c => c.Field);
        if (!transColNames.includes('reference_id')) {
          await db.query('ALTER TABLE transactions ADD COLUMN reference_id CHAR(36) AFTER description');
        }
        if (!transColNames.includes('reference_type')) {
          await db.query('ALTER TABLE transactions ADD COLUMN reference_type VARCHAR(50) AFTER reference_id');
        }
        if (!transColNames.includes('balance_before')) {
          await db.query('ALTER TABLE transactions ADD COLUMN balance_before DECIMAL(18, 2) NOT NULL DEFAULT 0.00 AFTER amount');
        }
        if (!transColNames.includes('balance_after')) {
          await db.query('ALTER TABLE transactions ADD COLUMN balance_after DECIMAL(18, 2) NOT NULL DEFAULT 0.00 AFTER balance_before');
        }
        // Ensure amount is DECIMAL(18,2)
        await db.query('ALTER TABLE transactions MODIFY COLUMN amount DECIMAL(18, 2) NOT NULL');
        
        // Add unique index for reference
        try {
          await db.query('CREATE UNIQUE INDEX idx_unique_payment ON transactions (reference_id, reference_type)');
        } catch (e) { /* Index might exist */ }
      } catch (e) { /* Table might not exist yet */ }

      // Add ip_address to logs if missing
      try {
        const logCols = await db.query('SHOW COLUMNS FROM logs');
        const logColNames = logCols.map(c => c.Field);
        if (!logColNames.includes('ip_address')) {
          await db.query('ALTER TABLE logs ADD COLUMN ip_address VARCHAR(45) AFTER details');
        }
        if (!logColNames.includes('user_agent')) {
          await db.query('ALTER TABLE logs ADD COLUMN user_agent TEXT AFTER ip_address');
        }
        if (!logColNames.includes('before_state')) {
          await db.query('ALTER TABLE logs ADD COLUMN before_state JSON AFTER user_agent');
        }
        if (!logColNames.includes('after_state')) {
          await db.query('ALTER TABLE logs ADD COLUMN after_state JSON AFTER before_state');
        }
        if (!logColNames.includes('actor_role')) {
          await db.query('ALTER TABLE logs ADD COLUMN actor_role VARCHAR(50) AFTER user_agent');
        }
        if (!logColNames.includes('request_id')) {
          await db.query('ALTER TABLE logs ADD COLUMN request_id VARCHAR(36) AFTER actor_role');
        }
        if (!logColNames.includes('resource_type')) {
          await db.query('ALTER TABLE logs ADD COLUMN resource_type VARCHAR(50) AFTER request_id');
        }
        if (!logColNames.includes('resource_id')) {
          await db.query('ALTER TABLE logs ADD COLUMN resource_id VARCHAR(100) AFTER resource_type');
        }
      } catch (e) { /* Table might not exist yet */ }

      // Add composite indexes
      try {
        await db.query('CREATE INDEX idx_orders_user_created ON orders (user_id, created_at)');
      } catch (e) { /* Index might exist */ }
      try {
        await db.query('CREATE INDEX idx_orders_status_created ON orders (status, created_at)');
      } catch (e) { /* Index might exist */ }
      try {
        await db.query('CREATE INDEX idx_orders_serial ON orders (serial_number)');
      } catch (e) { /* Index might exist */ }
      try {
        await db.query('CREATE INDEX idx_transactions_user_created ON transactions (user_id, created_at)');
      } catch (e) { /* Index might exist */ }
      try {
        await db.query('CREATE INDEX idx_logs_user_id ON logs (user_id)');
      } catch (e) { /* Index might exist */ }
      try {
        await db.query('CREATE INDEX idx_logs_created_at ON logs (created_at)');
      } catch (e) { /* Index might exist */ }
      try {
        await db.query('CREATE INDEX idx_logs_resource ON logs (resource_type, resource_id)');
      } catch (e) { /* Index might exist */ }

    } catch (e) {
      logger.error('Error updating orders table columns:', e);
    }

    // Ensure settings table has all columns and a default row
    try {
      const columns = await db.query('SHOW COLUMNS FROM settings');
      const columnNames = columns.map(c => c.Field);
      
      const requiredColumns = [
        { name: 'site_name', type: 'VARCHAR(100) DEFAULT "THOUESA"' },
        { name: 'site_logo', type: 'TEXT' },
        { name: 'hero_title', type: 'VARCHAR(255)' },
        { name: 'hero_slogan', type: 'VARCHAR(255)' },
        { name: 'hero_bg', type: 'TEXT' },
        { name: 'hero_bg_mobile', type: 'TEXT' },
        { name: 'main_screen_title', type: 'VARCHAR(255)' },
        { name: 'main_screen_description', type: 'TEXT' },
        { name: 'insurance_rate', type: 'DECIMAL(10, 2) DEFAULT 2.00' },
        { name: 'referral_reward_jod', type: 'DECIMAL(18, 2) DEFAULT 1.00' },
        { name: 'news_text', type: 'TEXT' },
        { name: 'footer_text', type: 'TEXT' },
        { name: 'terms_conditions', type: 'TEXT' },
        { name: 'privacy_policy', type: 'TEXT' },
        { name: 'social_facebook', type: 'VARCHAR(255)' },
        { name: 'social_whatsapp', type: 'VARCHAR(255)' },
        { name: 'social_instagram', type: 'VARCHAR(255)' },
        { name: 'social_tiktok', type: 'VARCHAR(255)' },
        { name: 'faqs', type: 'JSON' }
      ];

      for (const col of requiredColumns) {
        if (!columnNames.includes(col.name)) {
          await db.query(`ALTER TABLE settings ADD COLUMN ${col.name} ${col.type}`);
        }
      }

      // Seed default settings if not exists
      const existing = await db.query('SELECT id FROM settings');
      if (existing.length === 0) {
        const { v4: uuidv4 } = require('uuid');
        await db.query('INSERT INTO settings (id, site_name) VALUES (?, "THOUESA")', [uuidv4()]);
        logger.info('Default settings row created');
      }
    } catch (e) {
      logger.error('Error updating settings table:', e);
    }

    logger.info('Database schema initialized successfully.');

    // Seed Admin User
    try {
      const bcrypt = require('bcryptjs');
      const { v4: uuidv4 } = require('uuid');
      const adminEmail = 'admin@thouesa.com';
      const adminPass = 'adminPassword123';
      
      const existing = await db.query('SELECT id FROM users WHERE email = ?', [adminEmail]);
      if (existing.length === 0) {
        const id = uuidv4();
        const hashedPassword = await bcrypt.hash(adminPass, 12);
        await db.query(
          'INSERT INTO users (id, customer_id, full_name, email, password, phone, role, verification_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [id, 'ADM-001', 'مدير النظام', adminEmail, hashedPassword, '962790000000', 'admin', 'verified']
        );
        logger.info('Default admin user created: ' + adminEmail);
      }
    } catch (e) {
      logger.error('Error seeding admin user:', e);
    }

  } catch (error) {
    logger.error('Failed to initialize database schema:', error);
  }
};

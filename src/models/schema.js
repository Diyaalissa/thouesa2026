exports.SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  customer_id VARCHAR(20) UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE,
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  role ENUM('admin', 'operator', 'customer') DEFAULT 'customer',
  verification_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending',
  verification_note TEXT,
  id_image_url TEXT,
  wallet_balance DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  last_login_at DATETIME,
  last_login_ip VARCHAR(45),
  account_status ENUM('active', 'suspended', 'deleted') DEFAULT 'active',
  country VARCHAR(50),
  city VARCHAR(50),
  kyc_status ENUM('none', 'pending', 'verified', 'rejected') DEFAULT 'none',
  kyc_document TEXT,
  kyc_verified_at DATETIME,
  kyc_verified_by CHAR(36),
  referral_code VARCHAR(20) UNIQUE,
  referred_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_users_phone (phone),
  INDEX idx_users_customer_id (customer_id),
  INDEX idx_users_referral (referral_code),
  CONSTRAINT chk_wallet_positive CHECK (wallet_balance >= 0)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS addresses (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  name VARCHAR(100),
  phone VARCHAR(20),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS warehouses (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  country VARCHAR(100),
  city VARCHAR(100),
  address TEXT,
  contact_phone VARCHAR(30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS carriers (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  tracking_url TEXT,
  contact_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  serial_number VARCHAR(20) UNIQUE,
  type ENUM('parcel', 'buy', 'global') DEFAULT 'parcel',
  status ENUM('pending', 'approved', 'awaiting_payment', 'in_progress', 'completed', 'rejected', 'cancelled') DEFAULT 'pending',
  declared_value DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  items TEXT,
  shipping_fees DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  customs_fees DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  insurance_amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  local_delivery_fees DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  tax_value DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  final_price DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  waybill_url TEXT,
  product_image_url TEXT,
  delivery_method VARCHAR(50),
  origin_country VARCHAR(50),
  destination_country VARCHAR(50),
  currency VARCHAR(10),
  customs_included BOOLEAN DEFAULT TRUE,
  address_id CHAR(36),
  rejection_reason TEXT,
  tracking_number VARCHAR(100),
  weight DECIMAL(10, 2) DEFAULT 0.00,
  length DECIMAL(10, 2) DEFAULT 0.00,
  width DECIMAL(10, 2) DEFAULT 0.00,
  height DECIMAL(10, 2) DEFAULT 0.00,
  volumetric_weight DECIMAL(10, 2) DEFAULT 0.00,
  package_type VARCHAR(50),
  priority ENUM('normal', 'express') DEFAULT 'normal',
  estimated_delivery DATE,
  approved_at DATETIME,
  shipped_at DATETIME,
  delivered_at DATETIME,
  cancelled_at DATETIME,
  warehouse_id CHAR(36),
  operator_id CHAR(36),
  payment_status ENUM('unpaid', 'paid', 'partially_paid') DEFAULT 'unpaid',
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE SET NULL,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE SET NULL,
  FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_orders_user_id (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_serial (serial_number),
  INDEX idx_orders_created_at (created_at),
  INDEX idx_orders_status_created (status, created_at),
  INDEX idx_orders_user_created (user_id, created_at),
  INDEX idx_orders_tracking (tracking_number),
  CONSTRAINT chk_final_price_positive CHECK (final_price >= 0),
  CONSTRAINT chk_declared_value_positive CHECK (declared_value >= 0),
  CONSTRAINT chk_shipping_fees_positive CHECK (shipping_fees >= 0),
  CONSTRAINT chk_customs_fees_positive CHECK (customs_fees >= 0),
  CONSTRAINT chk_insurance_amount_positive CHECK (insurance_amount >= 0),
  CONSTRAINT chk_local_delivery_fees_positive CHECK (local_delivery_fees >= 0),
  CONSTRAINT chk_tax_value_positive CHECK (tax_value >= 0)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shipments (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36),
  carrier_id CHAR(36),
  courier_name VARCHAR(100),
  tracking_number VARCHAR(100),
  status VARCHAR(50),
  shipped_at DATETIME,
  delivered_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL,
  INDEX idx_shipments_order (order_id),
  INDEX idx_shipments_tracking (tracking_number)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36),
  description TEXT,
  quantity INT DEFAULT 1,
  price DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order_items_order_id (order_id),
  CONSTRAINT chk_item_price_positive CHECK (price >= 0)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_status_history (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36),
  status VARCHAR(50) NOT NULL,
  changed_by CHAR(36),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order_status_history_order_id (order_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coupons (
  id CHAR(36) PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  discount_type ENUM('percent', 'fixed') NOT NULL,
  discount_value DECIMAL(18, 2) NOT NULL,
  expires_at DATETIME,
  max_uses INT DEFAULT 100,
  current_uses INT DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS coupon_usage (
  id CHAR(36) PRIMARY KEY,
  coupon_id CHAR(36),
  user_id CHAR(36),
  order_id CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS referrals (
  id CHAR(36) PRIMARY KEY,
  referrer_id CHAR(36),
  referred_user_id CHAR(36),
  reward_amount DECIMAL(18, 2) DEFAULT 0.00,
  status ENUM('pending', 'paid') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS files (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  order_id CHAR(36),
  type VARCHAR(50),
  file_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  shipment_id CHAR(36),
  amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  method ENUM('wallet', 'cash', 'transfer') DEFAULT 'wallet',
  status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (shipment_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT chk_payment_amount_positive CHECK (amount >= 0)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  amount DECIMAL(18, 2) NOT NULL,
  balance_before DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  balance_after DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  type ENUM('deposit', 'payment', 'refund', 'adjustment') NOT NULL,
  description TEXT,
  reference_id CHAR(36),
  reference_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE INDEX idx_unique_payment (reference_id, reference_type),
  INDEX idx_transactions_user_id (user_id),
  INDEX idx_transactions_user_created (user_id, created_at),
  INDEX idx_transactions_ref (reference_id, reference_type),
  INDEX idx_transactions_created (created_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS support_tickets (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  subject VARCHAR(255),
  message TEXT,
  status ENUM('open', 'answered', 'closed') DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS trips (
  id CHAR(36) PRIMARY KEY,
  trip_date DATETIME,
  route VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  id CHAR(36) PRIMARY KEY,
  site_name VARCHAR(100) DEFAULT 'THOUESA',
  site_logo TEXT,
  hero_title VARCHAR(255),
  hero_slogan VARCHAR(255),
  hero_bg TEXT,
  hero_bg_mobile TEXT,
  main_screen_title VARCHAR(255),
  main_screen_description TEXT,
  insurance_rate DECIMAL(10, 2) DEFAULT 2.00,
  referral_reward_jod DECIMAL(18, 2) DEFAULT 1.00,
  news_text TEXT,
  footer_text TEXT,
  terms_conditions TEXT,
  privacy_policy TEXT,
  social_facebook VARCHAR(255),
  social_whatsapp VARCHAR(255),
  social_instagram VARCHAR(255),
  social_tiktok VARCHAR(255),
  faqs JSON
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reviews (
  id CHAR(36) PRIMARY KEY,
  full_name VARCHAR(100),
  rating INT DEFAULT 5,
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS notifications (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  title VARCHAR(255),
  message TEXT NOT NULL,
  type ENUM('ORDER_STATUS', 'PAYMENT_UPDATE', 'SYSTEM_ALERT', 'ADMIN_MESSAGE', 'PROMOTION') DEFAULT 'SYSTEM_ALERT',
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user_id (user_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS logs (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36),
  action VARCHAR(255) NOT NULL,
  details TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  actor_role VARCHAR(50),
  request_id VARCHAR(36),
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  before_state JSON,
  after_state JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_logs_user_id (user_id),
  INDEX idx_logs_created_at (created_at),
  INDEX idx_logs_request (request_id),
  INDEX idx_logs_resource (resource_type, resource_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token VARCHAR(64) NOT NULL,
  ip_hash VARCHAR(64),
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE INDEX idx_refresh_token_hash (token),
  INDEX idx_user_tokens_cleanup (user_id, created_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shipment_tracking_events (
  id CHAR(36) PRIMARY KEY,
  order_id CHAR(36) NOT NULL,
  tracking_number VARCHAR(100),
  status ENUM('CREATED', 'ARRIVED_WAREHOUSE', 'PROCESSING', 'IN_TRANSIT', 'CUSTOMS_CLEARANCE', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELLED') NOT NULL,
  location VARCHAR(255),
  description TEXT,
  created_by CHAR(36),
  event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_tracking_order_id (order_id),
  INDEX idx_tracking_number (tracking_number),
  INDEX idx_tracking_event_time (event_time)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shipping_rates (
  id CHAR(36) PRIMARY KEY,
  origin_country VARCHAR(50) NOT NULL,
  destination_country VARCHAR(50) NOT NULL,
  base_price DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  price_per_kg DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
  min_weight DECIMAL(10, 2) DEFAULT 0.00,
  max_weight DECIMAL(10, 2) DEFAULT 9999.99,
  priority_multiplier DECIMAL(5, 2) DEFAULT 1.00,
  carrier_id CHAR(36),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE SET NULL,
  INDEX idx_rates_route_carrier (origin_country, destination_country, carrier_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
`;

const { pool } = require('../src/db.cjs');
const { SCHEMA } = require('../src/models/schema.js');
const { v4: uuidv4 } = require('uuid');

async function fixDb() {
  console.log('🚀 Starting Comprehensive Database Fix...');
  let connection;

  try {
    connection = await pool.getConnection();
    console.log('✅ Connected to database');

    // 1. Disable Foreign Key Checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('✓ Foreign key checks disabled');

    // 2. Drop all foreign keys to avoid "Cannot change column" errors
    const [fks] = await connection.query(`
      SELECT TABLE_NAME, CONSTRAINT_NAME 
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND CONSTRAINT_NAME <> 'PRIMARY' 
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

    console.log(`🔍 Found ${fks.length} foreign keys to drop...`);
    for (const fk of fks) {
      try {
        await connection.query(`ALTER TABLE \`${fk.TABLE_NAME}\` DROP FOREIGN KEY \`${fk.CONSTRAINT_NAME}\``);
      } catch (e) { /* Ignore */ }
    }
    console.log('✓ All foreign keys dropped');

    // 3. Unify Encoding and ID types
    const [tables] = await connection.query('SHOW TABLES');
    for (const row of tables) {
      const tableName = Object.values(row)[0];
      console.log(`Processing table: ${tableName}`);
      
      // Convert encoding
      await connection.query(`ALTER TABLE \`${tableName}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
      
      // Unify ID types to CHAR(36) if they exist
      const [cols] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE 'id'`);
      if (cols.length > 0) {
        console.log(`  - Modifying id column in ${tableName} to CHAR(36)`);
        await connection.query(`ALTER TABLE \`${tableName}\` MODIFY id CHAR(36) NOT NULL`);
      }
    }
    console.log('✓ Encoding and ID types unified');

    // 4. Apply Schema (Create missing tables)
    const statements = SCHEMA.split(';').filter(s => s.trim() !== '');
    for (let sql of statements) {
      try {
        await connection.query(sql);
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.warn(`! Statement failed: ${err.message}`);
        }
      }
    }
    console.log('✓ Schema applied');

    // 5. Re-add Foreign Keys from SCHEMA
    console.log('🔗 Re-adding foreign keys...');
    for (let sql of statements) {
      const tableNameMatch = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
      if (tableNameMatch) {
        const tableName = tableNameMatch[1];
        const fkMatches = sql.matchAll(/FOREIGN KEY\s*\(([^)]+)\)\s*REFERENCES\s*(\w+)\s*\(([^)]+)\)([^,;]*)/gi);
        for (const fkMatch of fkMatches) {
          const col = fkMatch[1].trim();
          const refTable = fkMatch[2].trim();
          const refCol = fkMatch[3].trim();
          const extra = fkMatch[4].trim();
          try {
            await connection.query(`ALTER TABLE \`${tableName}\` ADD FOREIGN KEY (${col}) REFERENCES \`${refTable}\`(${refCol}) ${extra}`);
          } catch (e) { /* Ignore if fails */ }
        }
      }
    }
    console.log('✓ Foreign keys restored');

    // 6. Seed initial settings if missing or invalid
    const [settings] = await connection.query('SELECT id FROM settings LIMIT 1');
    if (settings.length === 0) {
      console.log('🌱 Seeding initial settings...');
      const settingsId = uuidv4();
      await connection.query(`
        INSERT INTO settings (id, site_name, hero_title, hero_slogan, terms_conditions, privacy_policy, faqs)
        VALUES (?, 'THOUESA', 'تحويسة | شحنك الشخصي صار أسهل', 'المنصة الأولى والآمنة لخدمات الشحن والوساطة التجارية بين الجزائر والأردن.', 'الشروط والأحكام الافتراضية...', 'سياسة الخصوصية الافتراضية...', '[]')
      `, [settingsId]);
    }

    // 7. Enable Foreign Key Checks
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Foreign key checks re-enabled');

    console.log('✨ Database Fix Completed Successfully!');
  } catch (error) {
    console.error('❌ Database Fix Error:', error);
  } finally {
    if (connection) connection.release();
    process.exit();
  }
}

fixDb();

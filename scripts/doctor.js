const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { pool } = require('../src/db.cjs');

async function checkDoctor() {
  console.log('🩺 Running THOUESA System Diagnostics...\n');

  // 1. Check Environment Variables
  const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_NAME', 'DB_PASSWORD', 'JWT_SECRET', 'TOKEN_PEPPER'];
  const missingEnv = requiredEnv.filter(env => !process.env[env]);
  if (missingEnv.length > 0) {
    console.warn('⚠️ Missing Environment Variables:', missingEnv.join(', '));
    console.warn('   System will run in degraded mode (Static files only).');
  } else {
    console.log('✅ Environment variables check passed');
  }

  const seedEnv = ['ADMIN_EMAIL', 'ADMIN_PASS'];
  const missingSeed = seedEnv.filter(env => !process.env[env]);
  if (missingSeed.length > 0) {
    console.warn('⚠️ Missing optional seed variables (ADMIN_EMAIL, ADMIN_PASS). Admin seeding will be skipped.');
  }

  // 2. Check Critical Files
  const criticalFiles = [
    'app.js',
    'src/app.cjs',
    'src/db.cjs',
    'src/utils/initDb.js',
    'web/index.html'
  ];
  let filesMissing = false;
  criticalFiles.forEach(file => {
    if (fs.existsSync(path.join(__dirname, '..', file))) {
      console.log(`✅ File exists: ${file}`);
    } else {
      console.error(`❌ Missing critical file: ${file}`);
      filesMissing = true;
    }
  });
  
  if (filesMissing) {
    console.error('❌ Critical files are missing. Aborting.');
    process.exit(1);
  }

  // 3. Check Database Connection
  let dbOk = false;
  try {
    const [rows] = await pool.query('SELECT 1 + 1 AS result');
    if (rows[0].result === 2) {
      console.log('✅ Database connection successful');
      dbOk = true;
    }
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  }

  // 4. Check Uploads Directory
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    console.log('⚠️ Uploads directory missing, creating it...');
    fs.mkdirSync(uploadsDir);
  }
  console.log('✅ Uploads directory verified');

  console.log('\n🏁 Diagnostics complete.');
  if (!dbOk) {
    console.warn('⚠️ Database connection check failed. Functional tests will be skipped.');
  }
  process.exit(0);
}

checkDoctor().catch(err => {
  console.error('💥 Doctor script failed:', err);
  process.exit(1);
});

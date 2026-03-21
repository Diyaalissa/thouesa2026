const express = require('express');
const compression = require('compression');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger.js');
const sanitizeHtml = require('sanitize-html');
const upload = require('./middleware/uploadMiddleware.js');
const os = require('os');
const NodeCache = require('node-cache');
const { v4: uuidv4 } = require('uuid');
const appConfig = require('./config/appConfig.js');

const app = express();
app.use(compression());

// Request ID Middleware
app.use((req, res, next) => {
  req.requestId = uuidv4();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

const appCache = new NodeCache({ stdTTL: 600 });

// XSS Sanitation Middleware
const sanitizeMiddleware = (req, res, next) => {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeHtml(req.body[key]);
      }
    }
  }
  next();
};

// Trust proxy for express-rate-limit
// In production, specify the IP range of your proxy (e.g., Cloudflare)
// For now, we trust the first hop if configured
if (process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1') {
  app.set('trust proxy', 1);
}

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https://picsum.photos", "https://*.picsum.photos", "https://images.unsplash.com", "https://*.unsplash.com"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 10, 
  message: 'Too many authentication attempts from this IP, please try again after 15 minutes'
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/refresh-token', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// Backpressure Control (Simple concurrent request limit)
let activeRequests = 0;
const MAX_CONCURRENT = 1000;
app.use((req, res, next) => {
  if (activeRequests >= MAX_CONCURRENT) {
    logger.warn(`Server saturated: ${activeRequests} active requests`);
    return res.status(503).json({ message: 'Server is busy, please try again later' });
  }
  
  const start = Date.now();
  activeRequests++;
  let finished = false;
  const decrement = () => {
    if (!finished) {
      activeRequests--;
      finished = true;
      const duration = Date.now() - start;
      if (duration > 2000) {
        logger.warn(`Slow request: ${req.method} ${req.originalUrl} took ${duration}ms`, { requestId: req.requestId });
      }
    }
  };
  
  res.on('finish', decrement);
  res.on('close', decrement);
  next();
});

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(v => v.trim()) : [],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  maxAge: 600 // Cache preflight for 10 minutes
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(sanitizeMiddleware);
app.use(cookieParser());

// Health Check (Lightweight for Load Balancers)
app.get('/api/health', async (req, res) => {
  try {
    const { query } = require('./db.cjs');
    await query('SELECT 1');
    res.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Health Check Failure (DB down, but server is up):', error.message);
    res.status(503).json({ status: "error", database: "down", timestamp: new Date().toISOString() });
  }
});

// Metrics / Detailed Monitoring (Protected)
app.get('/api/metrics', async (req, res) => {
  const metricsKey = req.headers['x-metrics-key'];
  if (process.env.NODE_ENV === 'production' && metricsKey !== process.env.METRICS_KEY) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  let dbStatus = "connected";
  let poolStatus = "healthy";
  
  try {
    const { query, pool } = require('./db.cjs');
    const start = Date.now();
    await query('SELECT 1');
    const duration = Date.now() - start;
    
    if (pool._allConnections && pool._allConnections.length >= pool.config.connectionLimit) {
      poolStatus = "saturated";
    }
    
    if (duration > 1000) dbStatus = "slow";
  } catch (error) {
    dbStatus = "disconnected";
    poolStatus = "unknown";
  }

  res.json({
    status: (dbStatus === "connected" && poolStatus === "healthy") ? "ok" : "degraded",
    database: { status: dbStatus, pool: poolStatus },
    process: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    },
    os: {
      loadavg: os.loadavg(),
      freeMem: os.freemem(),
      totalMem: os.totalmem()
    },
    timestamp: new Date().toISOString()
  });
});

const { authenticate, authorize } = require('./middleware/authMiddleware.js');

// Server Info / Monitoring
app.get('/api/server-info', authenticate, authorize(['admin']), (req, res) => {
  res.json({
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    cpuUsage: process.cpuUsage(),
    os: {
      platform: os.platform(),
      release: os.release(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().length
    },
    timestamp: new Date().toISOString()
  });
});

// Static Files (No CSRF)
app.use('/web', express.static(path.join(__dirname, '../web')));

// Protected Uploads
app.get('/uploads/:filename', authenticate, async (req, res) => {
  const filename = req.params.filename;
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ message: 'Invalid filename' });
  }
  
  const fileUrl = '/uploads/' + filename;
  const { pool } = require('./db.cjs');
  try {
    const [files] = await pool.query('SELECT user_id FROM files WHERE file_url = ?', [fileUrl]);
    if (files.length > 0) {
      const file = files[0];
      if (file.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }
    } else {
      // If file not in DB, only admin can access or we deny.
      // For safety, let's deny if not admin.
      if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Forbidden' });
      }
    }
    
    const filePath = path.join(__dirname, '../uploads', filename);
    res.sendFile(filePath, (err) => {
      if (err) {
        res.status(404).json({ message: 'File not found' });
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Dashboard Routes (No CSRF)
app.get('/client', (req, res) => res.sendFile(path.join(__dirname, '../web/client.html')));
app.get('/gate77', (req, res) => res.sendFile(path.join(__dirname, '../web/gate77.html')));
app.get('/status', (req, res) => res.sendFile(path.join(__dirname, '../web/status.html')));

// CSRF Protection
const isSecure = process.env.NODE_ENV === 'production';
const csrfProtection = csrf({ 
  cookie: {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/'
  }
});

app.get('/api/csrf-token', csrfProtection, (req, res) => {
  const token = req.csrfToken();
  res.cookie('XSRF-TOKEN', token, {
    httpOnly: false, // Must be accessible by frontend
    secure: isSecure,
    sameSite: 'lax',
    path: '/'
  });
  res.json({ 
    status: 'success',
    message: '',
    data: { token } 
  });
});

// API Routes
const authRoutes = require('./routes/authRoutes.js');
const portalRoutes = require('./routes/portalRoutes.js');
const adminRoutes = require('./routes/adminRoutes.js');

// Apply CSRF protection to state-changing API routes
app.use('/api/auth', csrfProtection, authRoutes);
app.use('/api/v1', csrfProtection, portalRoutes);
app.use('/api/v1/admin/portal', csrfProtection, adminRoutes);

app.post('/api/v1/upload', authenticate, upload.single('file'), require('./controllers/uploadController.js').uploadFile);

// Cleanup expired refresh tokens every 24 hours
setInterval(async () => {
  try {
    const { query } = require('./db.cjs');
    await query('DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP');
    logger.info('Expired refresh tokens cleaned up');
  } catch (error) {
    logger.error('Failed to cleanup expired tokens:', error);
  }
}, 24 * 60 * 60 * 1000);

// SPA Fallback
app.get('*', (req, res, next) => {
  if (req.url.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../web/index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  // Log the error
  logger.error(`${status} - ${message} - ${req.originalUrl} - ${req.method} - ${req.ip}`, { 
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack 
  });
  
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ 
      status: 'error',
      message: 'Invalid CSRF token' 
    });
  }

  // Return the real error message to the client as requested
  res.status(status).json({
    message: message || 'Internal server error',
    status: 'error'
  });
});

module.exports = app;

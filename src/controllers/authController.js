const crypto = require('crypto');
const authService = require('../services/authService.js');
const logger = require('../utils/logger.js');
const { query } = require('../db.cjs');
const NodeCache = require('node-cache');
const { logAction } = require('../utils/auditLogger.js');

const loginAttemptsCache = new NodeCache({ stdTTL: 600 });
const TOKEN_PEPPER = process.env.TOKEN_PEPPER;

exports.register = async (req, res, next) => {
  try {
    let { name, email, password, phone } = req.body;
    
    // Basic validation
    if (!name || !password || !phone) {
      return res.status(400).json({ message: 'يرجى إدخال جميع البيانات المطلوبة (الاسم، كلمة المرور، الهاتف)' });
    }

    // Normalize phone
    const normalizedPhone = authService.normalizePhone(phone);

    if (email) {
      console.log('Checking existing email:', email);
      const existingUser = await authService.findUserByEmail(email);
      if (existingUser) {
        console.log('User found with email:', email, 'ID:', existingUser.id);
        return res.status(400).json({ message: 'البريد الإلكتروني مسجل مسبقاً' });
      }
    }

    const existingPhone = await query('SELECT id FROM users WHERE phone = ?', [normalizedPhone]);
    if (existingPhone.length > 0) {
      return res.status(400).json({ message: 'رقم الهاتف مسجل مسبقاً' });
    }

    const user = await authService.createUser({
      full_name: name,
      email,
      password,
      phone: normalizedPhone,
      role: 'customer'
    });
    
    const clientInfo = {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    };

    // Update last login info
    await query('UPDATE users SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?', [clientInfo.ip, user.id]);
    
    const { accessToken, refreshToken } = await authService.generateTokens(user, clientInfo);

    await logAction(user.id, 'REGISTER', { email: user.email }, req, null, null, null, null, null, 'user', user.id);

    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      status: 'success',
      message: 'تم التسجيل بنجاح',
      data: {
        user: { 
          id: user.id, 
          name: user.full_name,
          full_name: user.full_name,
          email: user.email, 
          role: user.role,
          phone: user.phone
        },
        token: accessToken,
        refreshToken
      }
    });
  } catch (error) {
    logger.error(error);
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, phone, password } = req.body;
    
    if (!password || (!email && !phone)) {
      return res.status(400).json({ message: 'يرجى إدخال البريد الإلكتروني أو الهاتف مع كلمة المرور' });
    }

    const identifier = email || phone;

    const attempts = loginAttemptsCache.get(identifier) || 0;
    if (attempts >= 5) {
      return res.status(429).json({ message: 'محاولات كثيرة جداً. يرجى المحاولة بعد 10 دقائق.' });
    }

    const user = await authService.findUserByIdentifier(identifier);

    if (!user) {
      loginAttemptsCache.set(identifier, attempts + 1);
      await logAction(null, 'LOGIN_FAILURE', { identifier, reason: 'User not found' }, req, null, null, null, null, null, 'auth', identifier);
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const isMatch = await authService.comparePassword(
      password,
      user.password
    );

    if (!isMatch) {
      loginAttemptsCache.set(identifier, attempts + 1);
      await logAction(user.id, 'LOGIN_FAILURE', { identifier, reason: 'Invalid password' }, req, null, null, null, null, null, 'auth', identifier);
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    loginAttemptsCache.del(identifier);
    
    // Cleanup old refresh tokens for this user on new login
    await query('DELETE FROM refresh_tokens WHERE user_id = ?', [user.id]);
    
    const clientInfo = {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    };

    // Update last login info
    await query('UPDATE users SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?', [clientInfo.ip, user.id]);

    const { accessToken, refreshToken } = await authService.generateTokens(user, clientInfo);

    await logAction(user.id, 'LOGIN', { identifier }, req, null, null, null, null, null, 'auth', identifier);

    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({
      status: 'success',
      message: 'تم تسجيل الدخول بنجاح',
      data: {
        user: {
          id: user.id,
          name: user.full_name,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          phone: user.phone
        },
        token: accessToken,
        refreshToken
      }
    });

  } catch (error) {
    logger.error(error);
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ message: 'Refresh token is required' });

    const clientInfo = {
      ip: req.ip,
      userAgent: req.headers['user-agent']
    };

    const result = await authService.refreshAccessToken(refreshToken, clientInfo);
    if (!result) return res.status(401).json({ message: 'Invalid or expired refresh token' });

    res.cookie('token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({
      status: 'success',
      message: 'Token refreshed',
      data: {
        token: result.accessToken,
        refreshToken: result.refreshToken
      }
    });
  } catch (error) {
    logger.error(error);
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (req.user && req.user.id) {
      if (refreshToken) {
        const hashedRefreshToken = crypto.createHash('sha256')
          .update(refreshToken + TOKEN_PEPPER)
          .digest('hex');
        await query('DELETE FROM refresh_tokens WHERE user_id = ? AND token = ?', [req.user.id, hashedRefreshToken]);
      } else {
        await query('DELETE FROM refresh_tokens WHERE user_id = ?', [req.user.id]);
      }
    }
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    res.json({
      status: 'success',
      message: 'تم تسجيل الخروج بنجاح',
      data: null
    });
  } catch (error) {
    logger.error(error);
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const sql = 'SELECT id, full_name, email, role, phone FROM users WHERE id = ?';
    const results = await query(sql, [req.user.id]);
    if (!results[0]) return res.status(404).json({ message: 'User not found' });
    
    // Format response to match expected user object structure
    const user = results[0];
    res.json({
      status: 'success',
      message: '',
      data: {
        ...user,
        name: user.full_name
      }
    });
  } catch (error) {
    logger.error(error);
    next(error);
  }
};

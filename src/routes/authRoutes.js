const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController.js');
const { registerSchema, loginSchema } = require('../validators/authValidator.js');
const { authenticate } = require('../middleware/authMiddleware.js');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  message: 'Too many login attempts from this IP, please try again after 15 minutes'
});

const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    return res.status(400).json({ 
      status: 'error',
      message: 'Validation error', 
      data: { errors: error.issues } 
    });
  }
};

router.post('/register', validate(registerSchema), authController.register);
router.post('/login', loginLimiter, validate(loginSchema), authController.login);
router.post('/refresh-token', authController.refreshToken);
router.post('/logout', authController.logout);
router.get('/me', authenticate, authController.getMe);

module.exports = router;

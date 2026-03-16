const logger = require('../utils/logger.js');

exports.validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    logger.warn('Validation Error:', error.errors);
    return res.status(400).json({
      message: 'Validation failed',
      errors: error.errors
    });
  }
};

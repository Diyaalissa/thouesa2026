const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const sensitiveKeys = ['password', 'token', 'refreshToken', 'accessToken', 'authorization', 'cookie', 'set-cookie'];

const filterSensitive = winston.format((info) => {
  const result = { ...info };
  if (result.message && typeof result.message === 'object') {
    sensitiveKeys.forEach(key => {
      if (result.message[key]) result.message[key] = '***';
    });
  }
  // Also check if sensitive keys are in the top level info object (metadata)
  sensitiveKeys.forEach(key => {
    if (result[key]) result[key] = '***';
  });
  return result;
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    filterSensitive(),
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      level: 'error'
    }),
    new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d'
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, requestId, ...meta }) => {
          const rid = requestId ? ` [${requestId}]` : '';
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} ${level}:${rid} ${message}${metaStr}`;
        })
      )
    })
  ]
});

module.exports = logger;

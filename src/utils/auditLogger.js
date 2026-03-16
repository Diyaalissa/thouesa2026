const { v4: uuidv4 } = require('uuid');
const { query } = require('../db.cjs');
const logger = require('./logger.js');

exports.logAction = async (userId, action, details, ipOrReq = null, userAgent = null, before = null, after = null, actorRole = null, requestId = null, resourceType = null, resourceId = null) => {
  try {
    let finalIp = ipOrReq;
    let finalUserAgent = userAgent;
    let finalRequestId = requestId;
    let finalActorRole = actorRole;
    let finalResourceType = resourceType;
    let finalResourceId = resourceId;

    if (ipOrReq && typeof ipOrReq === 'object' && ipOrReq.headers) {
      const req = ipOrReq;
      // Robust IP extraction for proxy environments
      finalIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.ip || req.socket.remoteAddress;
      finalUserAgent = req.headers['user-agent'];
      finalRequestId = req.requestId;
      finalActorRole = req.user ? req.user.role : null;
    }

    const sql = 'INSERT INTO logs (id, user_id, action, details, ip_address, user_agent, actor_role, request_id, resource_type, resource_id, before_state, after_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    await query(sql, [
      uuidv4(), 
      userId, 
      action, 
      typeof details === 'object' ? JSON.stringify(details) : details, 
      finalIp,
      finalUserAgent,
      finalActorRole,
      finalRequestId,
      finalResourceType,
      finalResourceId,
      before ? JSON.stringify(before) : null,
      after ? JSON.stringify(after) : null
    ]);
  } catch (error) {
    logger.error('Audit Log Database Error:', { error: error.message, action, userId });
  }
};

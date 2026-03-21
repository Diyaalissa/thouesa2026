const notificationService = require('../services/notificationService.js');
const appConfig = require('../config/appConfig.js');
const logger = require('../utils/logger.js');

exports.getMyNotifications = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || appConfig.paginationLimit;
        const offset = (page - 1) * limit;
        const notifications = await notificationService.getNotificationsByUserId(req.user.id, limit, offset);
        res.json(notifications);
    } catch (error) {
        logger.error(error);
        next(error);
    }
};

exports.read = async (req, res, next) => {
    try {
        await notificationService.markAsRead(req.params.id);
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        next(error);
    }
};

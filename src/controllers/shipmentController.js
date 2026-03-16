const shipmentService = require('../services/shipmentService.js');
const notificationService = require('../services/notificationService.js');
const appConfig = require('../config/appConfig.js');
const { logAction } = require('../utils/auditLogger.js');
const logger = require('../utils/logger.js');

exports.create = async (req, res, next) => {
    try {
        const shipment = await shipmentService.createShipment({
            ...req.body,
            user_id: req.user.id
        });
        await logAction(req.user.id, 'CREATE_SHIPMENT', { shipmentId: shipment.id });
        await notificationService.createNotification(req.user.id, `تم إنشاء طلب جديد بنجاح برقم ${shipment.serial_number}`);
        res.status(201).json(shipment);
    } catch (error) {
        logger.error(error);
        next(error);
    }
};

exports.getMyShipments = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || appConfig.paginationLimit;
        const offset = (page - 1) * limit;
        const shipments = await shipmentService.getShipmentsByUserId(req.user.id, limit, offset);
        res.json(shipments);
    } catch (error) {
        next(error);
    }
};

exports.getAll = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || appConfig.paginationLimit;
        const offset = (page - 1) * limit;
        const shipments = await shipmentService.getAllShipments(limit, offset);
        res.json(shipments);
    } catch (error) {
        next(error);
    }
};

exports.updateStatus = async (req, res, next) => {
    try {
        await shipmentService.updateShipment(req.params.id, { status: req.body.status });
        await logAction(req.user.id, 'UPDATE_SHIPMENT_STATUS', { shipmentId: req.params.id, status: req.body.status });
        res.json({ message: 'Shipment status updated' });
    } catch (error) {
        next(error);
    }
};

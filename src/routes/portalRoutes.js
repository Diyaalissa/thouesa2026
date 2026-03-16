const express = require('express');
const portalController = require('../controllers/portalController.js');
const { authenticate } = require('../middleware/authMiddleware.js');
const { validate } = require('../middleware/validateMiddleware.js');
const { createShipmentSchema } = require('../validators/shipmentValidator.js');

const router = express.Router();

// Public Routes
router.get('/public/portal/settings', portalController.getSettings);
router.get('/public/portal/trips', portalController.getTrips);
router.get('/public/portal/reviews', portalController.getReviews);

// Customer Routes
router.use('/customer/portal', authenticate);
router.get('/customer/portal/profile', portalController.getProfile);
router.get('/customer/portal/orders', portalController.getOrders);
router.post('/customer/portal/orders', validate(createShipmentSchema), portalController.createOrder);
router.post('/customer/portal/orders/:id/cancel', portalController.cancelOrder);
router.get('/customer/portal/addresses', portalController.getAddresses);
router.post('/customer/portal/addresses', portalController.createAddress);
router.delete('/customer/portal/addresses/:id', portalController.deleteAddress);
router.get('/customer/portal/transactions', portalController.getTransactions);
router.get('/customer/portal/tickets', portalController.getTickets);
router.post('/customer/portal/tickets', portalController.createTicket);
router.post('/customer/portal/upload/product', portalController.uploadProductImage);
router.post('/customer/portal/upload/id', portalController.uploadIdImage);

module.exports = router;

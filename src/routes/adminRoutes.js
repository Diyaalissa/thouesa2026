const express = require('express');
const rateLimit = require('express-rate-limit');
const adminController = require('../controllers/adminController.js');
const { authenticate, authorize } = require('../middleware/authMiddleware.js');
const { validate } = require('../middleware/validateMiddleware.js');
const { updateShipmentSchema } = require('../validators/shipmentValidator.js');

const router = express.Router();

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Limit each IP to 500 requests per windowMs for admin routes
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

router.use(adminLimiter);
router.use(authenticate);
router.use(authorize(['admin', 'operator']));

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getUsers);
router.get('/orders', adminController.getOrders);
router.get('/logs', adminController.loadLogs);
router.post('/orders/:id/status', validate(updateShipmentSchema), adminController.updateOrderStatus);
router.post('/users/:id/verification', adminController.updateUserVerification);
router.post('/users/:id/suspend', authorize(['admin']), adminController.suspendUser);
router.post('/users/:id/activate', authorize(['admin']), adminController.activateUser);
router.post('/users/:id/verify-kyc', authorize(['admin']), adminController.verifyKYC);
router.post('/notifications', adminController.sendNotification);
router.delete('/users/:id', authorize(['admin']), adminController.deleteUser);
router.get('/settings', adminController.getSettings);
router.post('/settings', authorize(['admin']), adminController.saveSettings);
router.get('/trips', adminController.getTrips);
router.post('/trips', adminController.addTrip);
router.delete('/trips/:id', adminController.deleteTrip);
router.get('/monthly-report', adminController.getMonthlyReport);
router.get('/tickets', adminController.getTickets);
router.post('/tickets/:id/reply', adminController.replyTicket);
router.get('/transactions', adminController.getTransactions);
router.get('/coupons', adminController.getCoupons);
router.post('/coupons', authorize(['admin']), adminController.addCoupon);
router.delete('/coupons/:id', authorize(['admin']), adminController.deleteCoupon);
router.post('/users/:id/wallet', authorize(['admin']), adminController.adjustWallet);

// Tracking Events
router.get('/tracking', adminController.getTrackingEvents);
router.post('/tracking', adminController.addTrackingEvent);
router.delete('/tracking/:id', adminController.deleteTrackingEvent);

// Shipping Rates
router.get('/rates', adminController.getShippingRates);
router.post('/rates', authorize(['admin']), adminController.addShippingRate);
router.put('/rates/:id', authorize(['admin']), adminController.updateShippingRate);
router.delete('/rates/:id', authorize(['admin']), adminController.deleteShippingRate);

router.get('/debug/run-tests', adminController.runTests);

module.exports = router;

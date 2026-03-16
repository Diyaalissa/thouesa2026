const walletService = require('../services/walletService.js');
const appConfig = require('../config/appConfig.js');

exports.getMyBalance = async (req, res, next) => {
    try {
        const balance = await walletService.getBalance(req.user.id);
        res.json({ balance });
    } catch (error) {
        logger.error(error);
        next(error);
    }
};

exports.getMyTransactions = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || appConfig.paginationLimit;
        const offset = (page - 1) * limit;
        const transactions = await walletService.getTransactionsByUserId(req.user.id, limit, offset);
        res.json(transactions);
    } catch (error) {
        next(error);
    }
};

exports.deposit = async (req, res, next) => {
    try {
        const transaction = await walletService.addTransaction({
            user_id: req.user.id,
            amount: req.body.amount,
            type: 'deposit',
            description: 'إيداع رصيد'
        });
        res.status(201).json(transaction);
    } catch (error) {
        next(error);
    }
};

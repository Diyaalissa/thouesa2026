const path = require('path');
const { query } = require('../db.cjs');
const { v4: uuidv4 } = require('uuid');

exports.uploadFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                status: 'error',
                message: 'No file uploaded',
                data: null
            });
        }
        
        const filePath = `/uploads/${req.file.filename}`;
        const fileUrl = process.env.APP_URL ? `${process.env.APP_URL}${filePath}` : filePath;
        const orderId = req.body.order_id || req.query.order_id || null;
        const type = req.body.type || 'general_upload';
        
        // Register in files table if user is logged in
        if (req.user) {
            const fileId = uuidv4();
            await query('INSERT INTO files (id, user_id, order_id, type, file_url) VALUES (?, ?, ?, ?, ?)', 
                [fileId, req.user.id, orderId, type, filePath]);
        }

        res.json({
            status: 'success',
            message: 'File uploaded successfully',
            data: { url: fileUrl }
        });
    } catch (error) {
        next(error);
    }
};

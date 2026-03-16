const path = require('path');

exports.uploadFile = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    
    const fileUrl = process.env.APP_URL ? `${process.env.APP_URL}/uploads/${req.file.filename}` : `/uploads/${req.file.filename}`;
    res.json({
        message: 'File uploaded successfully',
        url: fileUrl
    });
};

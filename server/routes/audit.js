const express = require('express');
const db = require('../database');
const { authenticateJWT, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * GET / - Get list of recent audit logs joined with users (Admin only)
 */
router.get('/', authenticateJWT, requireRole(['admin']), (req, res) => {
    try {
        const logs = db.prepare(`
            SELECT al.*, u.mobile, u.role
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            ORDER BY al.created_at DESC
            LIMIT 100
        `).all();
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

module.exports = router;

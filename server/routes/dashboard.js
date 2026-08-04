const express = require('express');
const attendanceService = require('../services/attendanceService');
const { authenticateJWT, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/stats', authenticateJWT, requireRole(['admin', 'teacher']), (req, res) => {
    try {
        const stats = attendanceService.getDashboardStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/recent', authenticateJWT, requireRole(['admin', 'teacher']), (req, res) => {
    try {
        const records = attendanceService.getRecentAttendance();
        res.json(records);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/department-stats', authenticateJWT, requireRole(['admin', 'teacher']), (req, res) => {
    try {
        const stats = attendanceService.getDepartmentStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/hourly', authenticateJWT, requireRole(['admin', 'teacher']), (req, res) => {
    try {
        const stats = attendanceService.getHourlyStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

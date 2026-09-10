const express = require('express');
const attendanceService = require('../services/attendanceService');
const googleSheets = require('../services/googleSheets');
const db = require('../database');
const { authenticateAPIKey, authenticateJWT, requireRole } = require('../middleware/auth');
const { validateScanRequest } = require('../middleware/validator');
const { logAction } = require('../utils/audit');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /scan - Process scan from RFID hardware (Socket.IO broadcast)
 * Endpoint handles both /api/attendance/scan and /api/rfid/scan
 */
router.post('/scan', authenticateAPIKey, validateScanRequest, (req, res) => {
    try {
        const { rfid_uid, device_id } = req.body;
        const { student, attendance } = attendanceService.processRfidScan(rfid_uid, device_id);
        
        const record = {
            date: attendance.date,
            time: attendance.time,
            student,
            attendance
        };
        
        // Append to Google Sheets asynchronously
        googleSheets.appendAttendance(record).catch(err => {
            logger.error(`Error in Google Sheets append: ${err.message}`);
        });

        // Real-time update using Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.emit('attendance:scan', record);
            logger.info(`Real-time update pushed via Socket.IO for UID: ${rfid_uid}`);
        } else {
            logger.warn('Socket.IO instance not found in app configuration');
        }
        
        res.json({ success: true, message: 'Scan successful', record });
    } catch (error) {
        if (error.message === 'STUDENT_NOT_FOUND') {
            return res.status(404).json({ error: 'Student not found for the given RFID' });
        }
        if (error.message === 'DUPLICATE_SCAN') {
            return res.status(409).json({ error: 'Duplicate scan ignored' });
        }
        logger.error(`Scan error: ${error.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /verify-card - ESP32 Hardware Scan (unauthenticated, custom payload)
 */
router.post('/verify-card', (req, res) => {
    const { studentUID, deviceID } = req.body;

    if (!studentUID || !deviceID) {
        return res.status(400).json({ error: 'Missing studentUID or deviceID' });
    }

    try {
        const { student, attendance } = attendanceService.processRfidScan(studentUID, deviceID);

        const record = {
            date: attendance.date,
            time: attendance.time,
            student,
            attendance
        };

        // Append to Google Sheets asynchronously
        googleSheets.appendAttendance(record).catch(err => {
            logger.error(`Error in Google Sheets append: ${err.message}`);
        });

        // Real-time update using Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.emit('attendance:scan', record);
            logger.info(`Real-time update pushed via Socket.IO for UID: ${studentUID}`);
        } else {
            logger.warn('Socket.IO instance not found in app configuration');
        }

        res.json({ status: 'MARKED', studentName: student.name });
    } catch (error) {
        if (error.message === 'STUDENT_NOT_FOUND') {
            return res.status(404).json({ status: 'UNKNOWN_STUDENT', error: 'Student not found for the given RFID' });
        }
        if (error.message === 'DUPLICATE_SCAN') {
            return res.status(409).json({ status: 'ALREADY_MARKED', error: 'Duplicate scan ignored' });
        }
        logger.error(`Verify card error: ${error.message}`);
        res.status(500).json({ status: 'ERROR', error: 'Internal server error' });
    }
});

/**
 * POST /manual - Manually mark attendance (Admin/Teacher only)
 */
router.post('/manual', authenticateJWT, requireRole(['admin', 'teacher']), (req, res) => {
    const { student_id, date, time, status = 'present' } = req.body;

    if (!student_id || !date || !time) {
        return res.status(400).json({ error: 'Missing required fields: student_id, date, time' });
    }

    try {
        const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Insert attendance record
        const resInsert = db.prepare(`
            INSERT INTO attendance (student_id, rfid_uid, date, time, status, device_id)
            VALUES (?, ?, ?, ?, ?, 'MANUAL')
        `).run(student_id, student.rfid_uid, date, time, status);

        const attendance = db.prepare('SELECT * FROM attendance WHERE id = ?').get(resInsert.lastInsertRowid);
        const record = { date, time, student, attendance };

        // Async sheets sync
        googleSheets.appendAttendance(record).catch(err => {
            logger.error(`Error in manual sync append: ${err.message}`);
        });

        // Push real-time Socket.IO update
        const io = req.app.get('io');
        if (io) {
            io.emit('attendance:scan', record);
        }

        // Audit Trail log
        logAction(req.user.id, 'manual_attendance_mark', { student_id, name: student.name, roll_number: student.roll_number, date, time, status });

        res.status(201).json({ success: true, message: 'Attendance marked manually', record });
    } catch (err) {
        res.status(500).json({ error: 'Failed to mark manual attendance: ' + err.message });
    }
});

/**
 * GET /today - Retrieve today's attendance logs
 */
router.get('/today', authenticateJWT, requireRole(['admin', 'teacher']), (req, res) => {
    try {
        const records = attendanceService.getTodayAttendance();
        res.json(records);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /history - Paginated log retrieval (Role Scoped)
 */
router.get('/history', authenticateJWT, (req, res) => {
    try {
        const filters = {
            from: req.query.from,
            to: req.query.to,
            department: req.query.department,
            search: req.query.search,
            page: req.query.page || 1,
            limit: req.query.limit || 10
        };

        // If Student, restrict results strictly to their own student_id
        if (req.user.role === 'student') {
            if (!req.user.student_id) {
                return res.status(400).json({ error: 'Student profile not linked to user account' });
            }
            filters.search = null;
            filters.department = null;
            
            const offset = (filters.page - 1) * filters.limit;
            let query = `
                SELECT a.*, s.name, s.roll_number, s.department, s.rfid_uid 
                FROM attendance a
                JOIN students s ON a.student_id = s.id
                WHERE a.student_id = ?
            `;
            let countQuery = 'SELECT COUNT(*) as total FROM attendance WHERE student_id = ?';
            const params = [req.user.student_id];
            
            if (filters.from) {
                query += ' AND a.date >= ?';
                countQuery += ' AND date >= ?';
                params.push(filters.from);
            }
            if (filters.to) {
                query += ' AND a.date <= ?';
                countQuery += ' AND date <= ?';
                params.push(filters.to);
            }

            query += ' ORDER BY a.date DESC, a.time DESC LIMIT ? OFFSET ?';
            const records = db.prepare(query).all(...params, parseInt(filters.limit), parseInt(offset));
            const totalResult = db.prepare(countQuery).get(...params);
            const total = totalResult ? totalResult.total : 0;

            return res.json({
                records,
                total,
                page: parseInt(filters.page),
                totalPages: Math.ceil(total / filters.limit)
            });
        }

        // If Teacher/Admin, run normal service call
        const result = attendanceService.getAttendanceHistory(filters);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

/**
 * POST /retry-sync - Manually trigger sync retry of unsynced records (Admin only)
 */
router.post('/retry-sync', authenticateJWT, requireRole(['admin']), async (req, res) => {
    try {
        const result = await googleSheets.retryUnsynced();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: 'Failed to retry sync: ' + err.message });
    }
});

module.exports = router;

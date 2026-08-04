const express = require('express');
const db = require('../database');
const bcrypt = require('bcryptjs');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { logAction } = require('../utils/audit');

const router = express.Router();

/**
 * GET / - List all teacher accounts (Admin only)
 */
router.get('/', authenticateJWT, requireRole(['admin']), (req, res) => {
    try {
        const teachers = db.prepare(`
            SELECT id, mobile, role, active_status, created_at
            FROM users
            WHERE role = 'teacher'
            ORDER BY id DESC
        `).all();
        res.json(teachers);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch teacher accounts' });
    }
});

/**
 * POST / - Add new teacher account (Admin only)
 */
router.post('/', authenticateJWT, requireRole(['admin']), (req, res) => {
    const { mobile, password } = req.body;

    if (!mobile || !password) {
        return res.status(400).json({ error: 'Mobile number and password are required' });
    }

    try {
        const existing = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
        if (existing) {
            return res.status(409).json({ error: 'User with this mobile number already exists' });
        }

        const hash = bcrypt.hashSync(password, 10);
        const result = db.prepare(`
            INSERT INTO users (mobile, password_hash, role, active_status)
            VALUES (?, ?, 'teacher', 1)
        `).run(mobile, hash);

        const newTeacher = db.prepare('SELECT id, mobile, role, active_status, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
        
        logAction(req.user.id, 'create_teacher', { teacher_id: newTeacher.id, mobile: newTeacher.mobile });

        res.status(201).json(newTeacher);
    } catch (err) {
        res.status(500).json({ error: 'Failed to create teacher account: ' + err.message });
    }
});

/**
 * PUT /:id/status - Toggle teacher active status (Admin only)
 */
router.put('/:id/status', authenticateJWT, requireRole(['admin']), (req, res) => {
    const { active_status } = req.body;
    const teacherId = req.params.id;

    if (active_status !== 0 && active_status !== 1) {
        return res.status(400).json({ error: 'Invalid active_status value. Must be 0 or 1.' });
    }

    try {
        const teacher = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'teacher'").get(teacherId);
        if (!teacher) {
            return res.status(404).json({ error: 'Teacher not found' });
        }

        db.prepare('UPDATE users SET active_status = ? WHERE id = ?').run(active_status, teacherId);

        logAction(req.user.id, 'toggle_teacher_status', { teacher_id: teacherId, mobile: teacher.mobile, active_status });

        res.json({ message: 'Teacher status updated successfully', active_status });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update status' });
    }
});

/**
 * DELETE /:id - Delete teacher account (Admin only)
 */
router.delete('/:id', authenticateJWT, requireRole(['admin']), (req, res) => {
    const teacherId = req.params.id;

    try {
        const teacher = db.prepare("SELECT * FROM users WHERE id = ? AND role = 'teacher'").get(teacherId);
        if (!teacher) {
            return res.status(404).json({ error: 'Teacher not found' });
        }

        db.prepare('DELETE FROM users WHERE id = ?').run(teacherId);

        logAction(req.user.id, 'delete_teacher', { teacher_id: teacherId, mobile: teacher.mobile });

        res.json({ message: 'Teacher account deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete teacher account' });
    }
});

module.exports = router;

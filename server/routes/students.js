const express = require('express');
const db = require('../database');
const bcrypt = require('bcryptjs');
const { authenticateJWT, requireRole } = require('../middleware/auth');
const { validateStudentData } = require('../middleware/validator');
const { logAction } = require('../utils/audit');

const router = express.Router();

/**
 * GET / - Get paginated/filtered list of students (Admins & Teachers only)
 */
router.get('/', authenticateJWT, requireRole(['admin', 'teacher']), (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM students WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as total FROM students WHERE 1=1';
        const params = [];
        
        if (search) {
            query += ' AND (name LIKE ? OR roll_number LIKE ? OR rfid_uid LIKE ? OR mobile LIKE ?)';
            countQuery += ' AND (name LIKE ? OR roll_number LIKE ? OR rfid_uid LIKE ? OR mobile LIKE ?)';
            const searchParam = `%${search}%`;
            params.push(searchParam, searchParam, searchParam, searchParam);
        }

        query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
        
        const records = db.prepare(query).all(...params, parseInt(limit), parseInt(offset));
        const total = db.prepare(countQuery).get(...params).total;
        
        res.json({
            records,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /profile - Retrieve currently logged-in student's profile
 */
router.get('/profile', authenticateJWT, (req, res) => {
    try {
        if (req.user.role !== 'student') {
            return res.status(400).json({ error: 'Only student accounts have a student profile' });
        }
        if (!req.user.student_id) {
            return res.status(400).json({ error: 'No student profile linked to this user account' });
        }
        const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.user.student_id);
        if (!student) {
            return res.status(404).json({ error: 'Student profile not found' });
        }
        res.json(student);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error: ' + error.message });
    }
});

/**
 * GET /:id - Retrieve single student profile (Admins & Teachers only)
 */
router.get('/:id', authenticateJWT, requireRole(['admin', 'teacher']), (req, res) => {
    try {
        const student = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }
        res.json(student);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST / - Add student and automatically create their user account (Admins & Teachers only)
 */
router.post('/', authenticateJWT, requireRole(['admin', 'teacher']), validateStudentData, (req, res) => {
    const { rfid_uid, name, roll_number, registration_number, department, semester, section, mobile, email, address, photo_url } = req.body;
    
    // Check duplicates in students
    const existing = db.prepare('SELECT * FROM students WHERE rfid_uid = ? OR roll_number = ? OR mobile = ?').get(rfid_uid, roll_number, mobile);
    if (existing) {
        return res.status(409).json({ error: 'Student with this RFID, Roll Number, or Mobile Number already exists' });
    }

    // Check duplicate in users
    const existingUser = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
    if (existingUser) {
        return res.status(409).json({ error: 'A user account with this mobile number already exists' });
    }

    db.exec('BEGIN TRANSACTION;');
    try {
        // 1. Create Student User Account
        const defaultPasswordHash = bcrypt.hashSync('student123', 10);
        const userRes = db.prepare(`
            INSERT INTO users (mobile, password_hash, role)
            VALUES (?, ?, 'student')
        `).run(mobile, defaultPasswordHash);
        const userId = userRes.lastInsertRowid;

        // 2. Create Student Profile
        const studentRes = db.prepare(`
            INSERT INTO students (user_id, rfid_uid, name, roll_number, registration_number, department, semester, section, mobile, email, address, photo_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(userId, rfid_uid, name, roll_number, registration_number, department, semester ? parseInt(semester) : null, section, mobile, email, address, photo_url);
        
        const newStudent = db.prepare('SELECT * FROM students WHERE id = ?').get(studentRes.lastInsertRowid);
        
        db.exec('COMMIT;');

        // Log audit trail
        logAction(req.user.id, 'create_student', { student_id: newStudent.id, name: newStudent.name, roll_number: newStudent.roll_number });

        const io = req.app.get('io');
        if (io) {
            io.emit('student_update', { action: 'create', student: newStudent });
        }
        
        res.status(201).json(newStudent);
    } catch (error) {
        db.exec('ROLLBACK;');
        res.status(500).json({ error: 'Failed to create student and user account: ' + error.message });
    }
});

/**
 * PUT /:id - Edit student and sync their mobile number in users table (Admins & Teachers only)
 */
router.put('/:id', authenticateJWT, requireRole(['admin', 'teacher']), validateStudentData, (req, res) => {
    const { rfid_uid, name, roll_number, registration_number, department, semester, section, mobile, email, address, photo_url } = req.body;
    const studentId = req.params.id;

    try {
        const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Validate duplicates for others
        const existingConflict = db.prepare('SELECT * FROM students WHERE (rfid_uid = ? OR roll_number = ? OR mobile = ?) AND id != ?').get(rfid_uid, roll_number, mobile, studentId);
        if (existingConflict) {
            return res.status(409).json({ error: 'RFID, Roll Number, or Mobile number belongs to another student' });
        }

        db.exec('BEGIN TRANSACTION;');
        // 1. Update linked User account mobile number if user_id exists
        if (student.user_id) {
            db.prepare(`
                UPDATE users SET mobile = ? WHERE id = ?
            `).run(mobile, student.user_id);
        }

        // 2. Update Student Profile
        db.prepare(`
            UPDATE students
            SET rfid_uid = ?, name = ?, roll_number = ?, registration_number = ?, department = ?, semester = ?, section = ?, mobile = ?, email = ?, address = ?, photo_url = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `).run(rfid_uid, name, roll_number, registration_number, department, semester ? parseInt(semester) : null, section, mobile, email, address, photo_url, studentId);
        
        db.exec('COMMIT;');

        const updatedStudent = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);

        // Log audit log
        logAction(req.user.id, 'update_student', { student_id: studentId, name: updatedStudent.name, roll_number: updatedStudent.roll_number });

        const io = req.app.get('io');
        if (io) {
            io.emit('student_update', { action: 'update', student: updatedStudent });
        }
        
        res.json(updatedStudent);
    } catch (error) {
        db.exec('ROLLBACK;');
        res.status(500).json({ error: 'Failed to update student profile: ' + error.message });
    }
});

/**
 * DELETE /:id - Delete student and delete their linked user account (Admin only)
 */
router.delete('/:id', authenticateJWT, requireRole(['admin']), (req, res) => {
    const studentId = req.params.id;

    try {
        const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        db.exec('BEGIN TRANSACTION;');
        // 1. Delete student profile (this automatically cascades or we manually delete linked user)
        db.prepare('DELETE FROM students WHERE id = ?').run(studentId);

        // 2. Delete linked User Account
        if (student.user_id) {
            db.prepare('DELETE FROM users WHERE id = ?').run(student.user_id);
        }
        db.exec('COMMIT;');

        // Log audit log
        logAction(req.user.id, 'delete_student', { student_id: studentId, name: student.name, roll_number: student.roll_number });

        const io = req.app.get('io');
        if (io) {
            io.emit('student_update', { action: 'delete', id: studentId });
        }
        res.json({ message: 'Student and linked user account deleted successfully' });
    } catch (error) {
        db.exec('ROLLBACK;');
        res.status(500).json({ error: 'Failed to delete student account' });
    }
});

module.exports = router;

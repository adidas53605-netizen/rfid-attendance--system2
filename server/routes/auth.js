const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');
const config = require('../config');
const { authenticateJWT } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /login - Authenticate with Mobile Number + Password
 */
router.post('/login', (req, res) => {
    const { mobile, password } = req.body;
    
    if (!mobile || !password) {
        return res.status(400).json({ error: 'Mobile number and password are required' });
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE mobile = ?').get(mobile);
        
        if (user && user.active_status === 1 && bcrypt.compareSync(password, user.password_hash)) {
            // Find student profile link if the role is student
            let studentId = null;
            if (user.role === 'student') {
                const student = db.prepare('SELECT id FROM students WHERE user_id = ?').get(user.id);
                if (student) {
                    studentId = student.id;
                }
            }

            const token = jwt.sign(
                { id: user.id, mobile: user.mobile, role: user.role, student_id: studentId },
                config.JWT_SECRET,
                { expiresIn: '24h' }
            );

            res.json({ token, role: user.role, mobile: user.mobile });
        } else if (user && user.active_status === 0) {
            res.status(403).json({ error: 'Account is deactivated' });
        } else {
            res.status(401).json({ error: 'Invalid mobile number or password' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /verify - Validate token and return user details
 */
router.post('/verify', authenticateJWT, (req, res) => {
    res.json({ valid: true, id: req.user.id, role: req.user.role, mobile: req.user.mobile, student_id: req.user.student_id });
});

module.exports = router;

const db = require('../database');
const config = require('../config');
const helpers = require('../utils/helpers');

const processRfidScan = (rfidUid, deviceId) => {
    const student = db.prepare('SELECT * FROM students WHERE rfid_uid = ?').get(rfidUid);
    
    if (!student) {
        throw new Error('STUDENT_NOT_FOUND');
    }

    const todayDate = helpers.getCurrentDate();
    const timeWindow = config.DUPLICATE_WINDOW_MINUTES;

    const lastScan = db.prepare(`
        SELECT * FROM attendance 
        WHERE student_id = ? AND date = ? 
        ORDER BY time DESC LIMIT 1
    `).get(student.id, todayDate);

    if (lastScan) {
        const currentTimeStr = helpers.getCurrentTime();
        const [currH, currM] = currentTimeStr.split(':').map(Number);
        const [lastH, lastM] = lastScan.time.split(':').map(Number);
        
        const currTotalMins = currH * 60 + currM;
        const lastTotalMins = lastH * 60 + lastM;
        
        if (currTotalMins - lastTotalMins < timeWindow) {
            throw new Error('DUPLICATE_SCAN');
        }
    }

    const currentDate = todayDate;
    const currentTime = helpers.getCurrentTime();

    const result = db.prepare(`
        INSERT INTO attendance (student_id, rfid_uid, date, time, status, device_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(student.id, rfidUid, currentDate, currentTime, 'present', deviceId);

    const attendance = db.prepare('SELECT * FROM attendance WHERE id = ?').get(result.lastInsertRowid);

    return { student, attendance };
};

const getTodayAttendance = () => {
    const today = helpers.getCurrentDate();
    return db.prepare(`
        SELECT a.*, s.name, s.roll_number, s.department, s.rfid_uid 
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE a.date = ?
        ORDER BY a.time DESC
    `).all(today);
};

const getAttendanceHistory = (filters) => {
    const { from, to, department, search, page = 1, limit = 10 } = filters;
    const offset = (page - 1) * limit;
    
    let query = `
        SELECT a.*, s.name, s.roll_number, s.department, s.rfid_uid 
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE 1=1
    `;
    const params = [];
    const countParams = [];
    
    let countQuery = `
        SELECT COUNT(*) as total 
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE 1=1
    `;

    if (from) {
        query += ` AND a.date >= ?`;
        countQuery += ` AND a.date >= ?`;
        params.push(from);
        countParams.push(from);
    }
    if (to) {
        query += ` AND a.date <= ?`;
        countQuery += ` AND a.date <= ?`;
        params.push(to);
        countParams.push(to);
    }
    if (department) {
        query += ` AND s.department = ?`;
        countQuery += ` AND s.department = ?`;
        params.push(department);
        countParams.push(department);
    }
    if (search) {
        query += ` AND (s.name LIKE ? OR s.roll_number LIKE ?)`;
        countQuery += ` AND (s.name LIKE ? OR s.roll_number LIKE ?)`;
        const searchParam = `%${search}%`;
        params.push(searchParam, searchParam);
        countParams.push(searchParam, searchParam);
    }

    query += ` ORDER BY a.date DESC, a.time DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const records = db.prepare(query).all(...params);
    const totalResult = db.prepare(countQuery).get(...countParams);
    const total = totalResult.total;
    const totalPages = Math.ceil(total / limit);

    return { records, total, page: parseInt(page), totalPages };
};

const getDashboardStats = () => {
    const today = helpers.getCurrentDate();
    
    const totalStudents = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
    const presentToday = db.prepare('SELECT COUNT(DISTINCT student_id) as count FROM attendance WHERE date = ? AND status = ?').get(today, 'present').count;
    const absentToday = totalStudents - presentToday;
    const totalScans = db.prepare('SELECT COUNT(*) as count FROM attendance').get().count;

    return { totalStudents, presentToday, absentToday, totalScans };
};

const getRecentAttendance = (limit = 10) => {
    return db.prepare(`
        SELECT a.*, s.name, s.roll_number, s.department 
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        ORDER BY a.date DESC, a.time DESC 
        LIMIT ?
    `).all(limit);
};

const getDepartmentStats = () => {
    const today = helpers.getCurrentDate();
    return db.prepare(`
        SELECT s.department, COUNT(DISTINCT a.student_id) as present_count
        FROM students s
        LEFT JOIN attendance a ON s.id = a.student_id AND a.date = ? AND a.status = 'present'
        GROUP BY s.department
    `).all(today);
};

const getHourlyStats = () => {
    const today = helpers.getCurrentDate();
    return db.prepare(`
        SELECT substr(time, 1, 2) as hour, COUNT(*) as scan_count
        FROM attendance
        WHERE date = ?
        GROUP BY hour
        ORDER BY hour
    `).all(today);
};

module.exports = {
    processRfidScan,
    getTodayAttendance,
    getAttendanceHistory,
    getDashboardStats,
    getRecentAttendance,
    getDepartmentStats,
    getHourlyStats
};

/**
 * Export Routes
 * CSV export via server-side generation.
 * PDF export returns JSON data for client-side PDF generation (avoids heavy pdfkit dependency).
 */
const express = require('express');
const db = require('../database');
const { authenticateJWT, requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * Query attendance records with optional filters
 */
const getExportData = (queryObj) => {
  const { from, to, department } = queryObj;
  let query = `
    SELECT a.date, a.time, s.name, s.roll_number, s.department, s.semester, a.status, a.device_id
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (from) {
    query += ` AND a.date >= ?`;
    params.push(from);
  }
  if (to) {
    query += ` AND a.date <= ?`;
    params.push(to);
  }
  if (department) {
    query += ` AND s.department = ?`;
    params.push(department);
  }

  query += ` ORDER BY a.date DESC, a.time DESC`;

  return db.prepare(query).all(...params);
};

/**
 * GET /csv — Download attendance as CSV file
 */
router.get('/csv', authenticateJWT, requireRole(['admin', 'teacher']), (req, res) => {
  try {
    const records = getExportData(req.query);

    let csv = 'Date,Time,Name,Roll Number,Department,Semester,Status,Device\n';
    for (const r of records) {
      const esc = (s) => `"${String(s || '').replace(/"/g, '""')}"`;
      csv += `${r.date},${r.time},${esc(r.name)},${esc(r.roll_number)},${esc(r.department)},${r.semester || ''},${r.status},${r.device_id || ''}\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance_export.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate CSV export' });
  }
});

/**
 * GET /pdf — Return attendance data as JSON for client-side PDF generation
 * The frontend uses the browser's print/PDF capabilities to generate the PDF.
 */
router.get('/pdf', authenticateJWT, requireRole(['admin', 'teacher']), (req, res) => {
  try {
    const records = getExportData(req.query);
    res.json({
      title: 'Attendance Report',
      generatedAt: new Date().toISOString(),
      filters: {
        from: req.query.from || null,
        to: req.query.to || null,
        department: req.query.department || null,
      },
      totalRecords: records.length,
      records,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate PDF data' });
  }
});

module.exports = router;

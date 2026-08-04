/**
 * Database Setup & Migrations (RBAC Enabled)
 * Uses Node's built-in node:sqlite module (synchronous).
 * Auto-creates tables, indexes, and seeds role-based sample data on first run.
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const bcrypt = require('bcryptjs');
const config = require('./config');

const DB_PATH = path.join(__dirname, '..', 'attendance.db');

const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// ─── Schema Migration ───────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    mobile          TEXT    UNIQUE NOT NULL,
    password_hash   TEXT    NOT NULL,
    role            TEXT    NOT NULL CHECK(role IN ('admin', 'teacher', 'student')),
    active_status   INTEGER DEFAULT 1,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS students (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER UNIQUE,
    rfid_uid        TEXT    UNIQUE NOT NULL,
    name            TEXT    NOT NULL,
    roll_number     TEXT    UNIQUE NOT NULL,
    registration_number TEXT UNIQUE,
    department      TEXT    NOT NULL,
    semester        INTEGER,
    section         TEXT,
    mobile          TEXT    UNIQUE NOT NULL,
    email           TEXT    UNIQUE,
    address         TEXT,
    photo_url       TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS attendance (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id      INTEGER NOT NULL,
    rfid_uid        TEXT    NOT NULL,
    date            TEXT    NOT NULL,
    time            TEXT    NOT NULL,
    status          TEXT    DEFAULT 'present',
    device_id       TEXT,
    synced_to_sheets INTEGER DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER,
    action          TEXT    NOT NULL,
    details         TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );
`);

// Create performance indexes separately
db.exec('CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile);');
db.exec('CREATE INDEX IF NOT EXISTS idx_students_rfid ON students(rfid_uid);');
db.exec('CREATE INDEX IF NOT EXISTS idx_students_user ON students(user_id);');
db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_student_date ON attendance(student_id, date);');
db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);');
db.exec('CREATE INDEX IF NOT EXISTS idx_attendance_synced ON attendance(synced_to_sheets);');
db.exec('CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);');

// ─── Seed Admin & Teacher Accounts ──────────────────────────────────
const seedUserCountResult = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role IN ('admin', 'teacher')").get();
const seedUserCount = seedUserCountResult ? seedUserCountResult.count : 0;

if (seedUserCount === 0) {
  const adminHash = bcrypt.hashSync('admin123', 10);
  db.prepare("INSERT INTO users (mobile, password_hash, role) VALUES ('9876543210', ?, 'admin')").run(adminHash);
  console.log('  ✓ Seeded Admin User: 9876543210 (admin123)');

  const teacherHash = bcrypt.hashSync('teacher123', 10);
  db.prepare("INSERT INTO users (mobile, password_hash, role) VALUES ('9876543211', ?, 'teacher')").run(teacherHash);
  console.log('  ✓ Seeded Teacher User: 9876543211 (teacher123)');
}

// ─── Seed Students & Student Users ──────────────────────────────────
const studentCountResult = db.prepare('SELECT COUNT(*) AS count FROM students').get();
const studentCount = studentCountResult ? studentCountResult.count : 0;

if (studentCount === 0) {
  const seedStudents = [
    { rfid_uid: 'A1B2C3D4', name: 'Aarav Sharma', roll_number: 'CSE-2024-001', registration_number: 'REG-20240001', department: 'Computer Science', semester: 5, section: 'A', mobile: '9876543220', email: 'aarav.sharma@university.edu', address: '12 MG Road, New Delhi', photo_url: '' },
    { rfid_uid: 'E5F6A7B8', name: 'Priya Patel', roll_number: 'ECE-2024-002', registration_number: 'REG-20240002', department: 'Electronics', semester: 3, section: 'B', mobile: '9876543221', email: 'priya.patel@university.edu', address: '45 Park Street, Mumbai', photo_url: '' },
    { rfid_uid: 'C9D0E1F2', name: 'Rahul Verma', roll_number: 'CSE-2024-003', registration_number: 'REG-20240003', department: 'Computer Science', semester: 5, section: 'A', mobile: '9876543222', email: 'rahul.verma@university.edu', address: '78 Lake View, Bangalore', photo_url: '' },
    { rfid_uid: '12345678', name: 'Sneha Gupta', roll_number: 'ME-2024-004', registration_number: 'REG-20240004', department: 'Mechanical', semester: 7, section: 'A', mobile: '9876543223', email: 'sneha.gupta@university.edu', address: '23 Civil Lines, Jaipur', photo_url: '' },
    { rfid_uid: 'AABBCCDD', name: 'Vikram Singh', roll_number: 'EE-2024-005', registration_number: 'REG-20240005', department: 'Electrical', semester: 3, section: 'C', mobile: '9876543224', email: 'vikram.singh@university.edu', address: '90 Station Road, Chennai', photo_url: '' },
    { rfid_uid: '11223344', name: 'Ananya Roy', roll_number: 'CSE-2024-006', registration_number: 'REG-20240006', department: 'Computer Science', semester: 5, section: 'B', mobile: '9876543225', email: 'ananya.roy@university.edu', address: '56 Green Park, Kolkata', photo_url: '' },
    { rfid_uid: '55667788', name: 'Karthik Nair', roll_number: 'ECE-2024-007', registration_number: 'REG-20240007', department: 'Electronics', semester: 7, section: 'A', mobile: '9876543226', email: 'karthik.nair@university.edu', address: '34 Beach Road, Kochi', photo_url: '' },
    { rfid_uid: '99AABB00', name: 'Meera Joshi', roll_number: 'CE-2024-008', registration_number: 'REG-20240008', department: 'Civil', semester: 3, section: 'A', mobile: '9876543227', email: 'meera.joshi@university.edu', address: '67 Hill View, Pune', photo_url: '' },
    { rfid_uid: 'DDEEFF11', name: 'Arjun Reddy', roll_number: 'CSE-2024-009', registration_number: 'REG-20240009', department: 'Computer Science', semester: 7, section: 'A', mobile: '9876543228', email: 'arjun.reddy@university.edu', address: '89 Tank Bund, Hyderabad', photo_url: '' },
    { rfid_uid: '22334455', name: 'Divya Iyer', roll_number: 'ME-2024-010', registration_number: 'REG-2024010', department: 'Mechanical', semester: 5, section: 'B', mobile: '9876543229', email: 'divya.iyer@university.edu', address: '12 Temple Street, Madurai', photo_url: '' },
  ];

  db.exec('BEGIN TRANSACTION;');
  try {
    const studentUserHash = bcrypt.hashSync('student123', 10);

    const insertUser = db.prepare(`
      INSERT INTO users (mobile, password_hash, role) VALUES (?, ?, 'student')
    `);

    const insertStudent = db.prepare(`
      INSERT INTO students (user_id, rfid_uid, name, roll_number, registration_number, department, semester, section, mobile, email, address, photo_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of seedStudents) {
      // 1. Create student user account
      const userRes = insertUser.run(s.mobile, studentUserHash);
      const userId = userRes.lastInsertRowid;

      // 2. Link student profile to user account
      insertStudent.run(
        userId,
        s.rfid_uid,
        s.name,
        s.roll_number,
        s.registration_number,
        s.department,
        s.semester,
        s.section,
        s.mobile,
        s.email,
        s.address,
        s.photo_url
      );
    }
    db.exec('COMMIT;');
    console.log(`  ✓ Seeded ${seedStudents.length} Students with linked Student User accounts (Password: student123)`);
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Failed to seed students and users database:', err);
  }
}

module.exports = db;

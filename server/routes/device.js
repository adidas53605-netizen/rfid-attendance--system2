const express = require('express');
const db = require('../database');
const { authenticateAPIKey } = require('../middleware/auth');
const logger = require('../utils/logger');
const config = require('../config');
const { logAction } = require('../utils/audit');
const googleSheets = require('../services/googleSheets');
const helpers = require('../utils/helpers');

const router = express.Router();

// Ensure device_status table is initialized inline
db.exec(`
  CREATE TABLE IF NOT EXISTS device_status (
    device_id        TEXT PRIMARY KEY,
    last_seen        DATETIME DEFAULT CURRENT_TIMESTAMP,
    firmware_version TEXT,
    uptime           INTEGER,
    free_heap        INTEGER
  );
`);

/**
 * POST /sync - Batch process offline-queued RFID scans
 */
router.post('/sync', authenticateAPIKey, (req, res) => {
    const { deviceId, records } = req.body;

    if (!deviceId || !Array.isArray(records)) {
        return res.status(400).json({ error: 'Missing deviceId or records array' });
    }

    let syncedCount = 0;
    const failed = [];
    const timeWindow = config.DUPLICATE_WINDOW_MINUTES || 30;

    for (const record of records) {
        const { rfidUid, deviceId: recordDeviceId, timestamp } = record;

        if (!rfidUid || !timestamp) {
            failed.push({
                record,
                reason: 'Missing rfidUid or timestamp'
            });
            continue;
        }

        try {
            // 1. Look up student
            const student = db.prepare('SELECT * FROM students WHERE rfid_uid = ?').get(rfidUid);
            if (!student) {
                failed.push({ record, reason: 'STUDENT_NOT_FOUND' });
                continue;
            }

            // 2. Parse timestamp
            let d;
            if (typeof timestamp === 'number') {
                const ts = timestamp < 9999999999 ? timestamp * 1000 : timestamp;
                d = new Date(ts);
            } else {
                d = new Date(timestamp);
            }

            if (isNaN(d.getTime())) {
                failed.push({ record, reason: 'INVALID_TIMESTAMP' });
                continue;
            }

            const recordDate = d.toISOString().split('T')[0];
            const recordTime = d.toISOString().split('T')[1].slice(0, 8); // HH:MM:SS

            // 3. Duplicate scan check
            const lastScan = db.prepare(`
                SELECT * FROM attendance 
                WHERE student_id = ? AND date = ? 
                ORDER BY time DESC LIMIT 1
            `).get(student.id, recordDate);

            if (lastScan) {
                const [currH, currM] = recordTime.split(':').map(Number);
                const [lastH, lastM] = lastScan.time.split(':').map(Number);
                
                const currTotalMins = currH * 60 + currM;
                const lastTotalMins = lastH * 60 + lastM;
                
                if (Math.abs(currTotalMins - lastTotalMins) < timeWindow) {
                    failed.push({ record, reason: 'DUPLICATE_SCAN' });
                    continue;
                }
            }

            // 4. Insert attendance record
            const targetDevice = recordDeviceId || deviceId;
            const resInsert = db.prepare(`
                INSERT INTO attendance (student_id, rfid_uid, date, time, status, device_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(student.id, rfidUid, recordDate, recordTime, 'present', targetDevice);

            const attendance = db.prepare('SELECT * FROM attendance WHERE id = ?').get(resInsert.lastInsertRowid);
            const attendanceRecord = {
                date: recordDate,
                time: recordTime,
                student,
                attendance
            };

            // Asynchronously append to Google Sheets
            googleSheets.appendAttendance(attendanceRecord).catch(err => {
                logger.error(`Error in sync Sheets append: ${err.message}`);
            });

            // Push to Dashboard clients via Socket.IO
            const io = req.app.get('io');
            if (io) {
                io.emit('attendance:scan', attendanceRecord);
            }

            syncedCount++;
        } catch (err) {
            logger.error(`Sync record error for UID ${rfidUid}: ${err.message}`);
            failed.push({ record, reason: err.message });
        }
    }

    // Log the sync summary to audit log
    logAction(null, 'device_offline_sync', {
        device_id: deviceId,
        total_records: records.length,
        synced_count: syncedCount,
        failed_count: failed.length
    });

    res.json({
        success: true,
        synced: syncedCount,
        failed
    });
});

/**
 * POST /heartbeat - Log device hardware metrics
 */
router.post('/heartbeat', authenticateAPIKey, (req, res) => {
    try {
        const { deviceId, firmwareVersion, uptime, freeHeap } = req.body;

        if (!deviceId) {
            return res.status(400).json({ error: 'Missing deviceId parameter' });
        }

        db.prepare(`
            INSERT OR REPLACE INTO device_status (device_id, last_seen, firmware_version, uptime, free_heap)
            VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?)
        `).run(deviceId, firmwareVersion || null, uptime || null, freeHeap || null);

        res.json({ success: true, message: 'Heartbeat received' });
    } catch (err) {
        logger.error(`Heartbeat log error: ${err.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /ota - Simple stub for over-the-air firmware updates
 */
router.get('/ota', authenticateAPIKey, (req, res) => {
    try {
        const deviceId = req.query.deviceId || req.headers['x-device-id'];
        const currentVersion = req.query.currentVersion || req.headers['x-current-version'];

        if (!deviceId || !currentVersion) {
            return res.status(400).json({ error: 'Missing deviceId or currentVersion parameters' });
        }

        // Read latest version from config or fallback to currentVersion (no update)
        const latestVersion = config.LATEST_FIRMWARE_VERSION || currentVersion;
        const updateAvailable = latestVersion !== currentVersion;

        const responsePayload = {
            updateAvailable,
            version: latestVersion
        };

        if (updateAvailable) {
            responsePayload.url = `http://localhost:${config.PORT || 3000}/firmware/rfid-update-${latestVersion}.bin`;
        }

        res.json(responsePayload);
    } catch (err) {
        logger.error(`OTA check error: ${err.message}`);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

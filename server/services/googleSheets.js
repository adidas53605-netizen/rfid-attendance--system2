/**
 * Google Sheets Sync Service
 * Uses native HTTPS with manual JWT generation from service account credentials.
 * No external googleapis or google-auth-library dependency needed.
 * 
 * Gracefully degrades when credentials are not available — the system
 * works fully without Google Sheets sync.
 */
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');
const db = require('../database');

let serviceAccountKey = null;
let enabled = false;
let cachedToken = null;
let tokenExpiry = 0;

// ─── Initialize ─────────────────────────────────────────────
const init = () => {
  try {
    const credPath = path.resolve(config.GOOGLE_CREDENTIALS_PATH);
    if (!config.GOOGLE_SHEET_ID || !fs.existsSync(credPath)) {
      logger.warn('Google Sheets credentials or Sheet ID not configured. Sync disabled.');
      return;
    }
    serviceAccountKey = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    enabled = true;
    logger.info('Google Sheets sync enabled.');
  } catch (err) {
    logger.error(`Google Sheets init error: ${err.message}`);
  }
};
init();

/**
 * Create a signed JWT for Google API authentication
 */
function createJWT() {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccountKey.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsigned = `${encode(header)}.${encode(payload)}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsigned);
  const signature = sign.sign(serviceAccountKey.private_key, 'base64url');
  return `${unsigned}.${signature}`;
}

/**
 * Get a valid access token (caches for 50 minutes)
 */
async function getAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const jwt = createJWT();
  const body = `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          cachedToken = parsed.access_token;
          tokenExpiry = Date.now() + 50 * 60 * 1000; // 50 min cache
          resolve(cachedToken);
        } catch (e) { reject(new Error('Failed to parse token response')); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Make an authenticated Sheets API request
 */
async function sheetsRequest(method, urlPath, body = null) {
  const token = await getAccessToken();
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'sheets.googleapis.com',
      path: urlPath,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`Sheets API ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Append attendance record to Google Sheet with retry
 */
const appendAttendance = async (record) => {
  if (!enabled) return;
  const { date, time, student, attendance } = record;
  const row = [
    date, time, student.rfid_uid, student.name, student.roll_number,
    student.department, String(student.semester || ''), attendance.status,
    attendance.device_id || '',
  ];

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const sheetId = encodeURIComponent(config.GOOGLE_SHEET_ID);
      const range = encodeURIComponent('Sheet1!A:I');
      await sheetsRequest('POST',
        `/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`,
        { values: [row] }
      );
      db.prepare('UPDATE attendance SET synced_to_sheets = 1 WHERE id = ?').run(attendance.id);
      logger.info(`Synced record ${attendance.id} to Sheets`);
      return;
    } catch (err) {
      logger.warn(`Sheets sync attempt ${attempt + 1} failed: ${err.message}`);
      if (attempt < 2) await sleep([1000, 2000, 4000][attempt]);
      else logger.error(`Failed to sync record ${attendance.id} after 3 attempts`);
    }
  }
};

const getSyncStatus = () => {
  const r = db.prepare('SELECT COUNT(*) as unsynced FROM attendance WHERE synced_to_sheets = 0').get();
  return { unsynced: r ? r.unsynced : 0 };
};

const retryUnsynced = async () => {
  if (!enabled) return { synced: 0, failed: 0 };
  const rows = db.prepare(`
    SELECT a.*, s.rfid_uid AS s_rfid, s.name AS s_name, s.roll_number AS s_roll,
           s.department AS s_dept, s.semester AS s_sem
    FROM attendance a JOIN students s ON a.student_id = s.id
    WHERE a.synced_to_sheets = 0
  `).all();
  let synced = 0, failed = 0;
  for (const r of rows) {
    try {
      await appendAttendance({
        date: r.date, time: r.time,
        student: { rfid_uid: r.s_rfid, name: r.s_name, roll_number: r.s_roll, department: r.s_dept, semester: r.s_sem },
        attendance: { id: r.id, status: r.status, device_id: r.device_id },
      });
      synced++;
    } catch { failed++; }
  }
  return { synced, failed };
};

const isEnabled = () => enabled;

module.exports = { appendAttendance, getSyncStatus, retryUnsynced, isEnabled };

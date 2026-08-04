/**
 * Audit Logger Utility
 * Records user actions (modifications, deletes, overrides) into the audit_logs table.
 */
const db = require('../database');
const logger = require('./logger');

/**
 * Log an administrative or teaching action
 * @param {number|null} userId - ID of the user performing the action
 * @param {string} action - Brief description of action (e.g. 'manual_attendance_mark')
 * @param {string|object} details - Extra data/JSON details about the change
 */
function logAction(userId, action, details) {
  try {
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details || '');
    
    db.prepare(`
      INSERT INTO audit_logs (user_id, action, details)
      VALUES (?, ?, ?)
    `).run(userId, action, detailsStr);
    
    logger.info(`Audit Log: User ${userId || 'SYSTEM'} performed "${action}" - ${detailsStr}`);
  } catch (err) {
    logger.error(`Failed to write audit log for action "${action}": ${err.message}`);
  }
}

module.exports = {
  logAction
};

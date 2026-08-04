/**
 * Helper Utilities
 * Date formatting, input sanitization, and common helpers.
 */

/**
 * Get current date as YYYY-MM-DD string
 */
function getCurrentDate() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Get current time as HH:MM:SS string
 */
function getCurrentTime() {
  const now = new Date();
  return now.toTimeString().split(' ')[0];
}

/**
 * Sanitize string input — trim whitespace and strip HTML tags
 */
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.trim().replace(/<[^>]*>/g, '');
}

/**
 * Validate RFID UID format — must be hex string, 4-20 chars
 */
function isValidRfidUid(uid) {
  if (typeof uid !== 'string') return false;
  return /^[A-Fa-f0-9]{4,20}$/.test(uid.trim());
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  if (!email) return true; // optional field
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Format date for display: "03 Aug 2026"
 */
function formatDateDisplay(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

module.exports = {
  getCurrentDate,
  getCurrentTime,
  sanitize,
  isValidRfidUid,
  isValidEmail,
  formatDateDisplay,
};

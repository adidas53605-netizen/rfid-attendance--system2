/**
 * Simple Logger Utility
 * Provides timestamped, leveled logging to console.
 */
const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const CURRENT_LEVEL = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function timestamp() {
  return new Date().toISOString();
}

const logger = {
  error: (...args) => {
    if (CURRENT_LEVEL >= LEVELS.error)
      console.error(`[${timestamp()}] ❌ ERROR:`, ...args);
  },
  warn: (...args) => {
    if (CURRENT_LEVEL >= LEVELS.warn)
      console.warn(`[${timestamp()}] ⚠️  WARN:`, ...args);
  },
  info: (...args) => {
    if (CURRENT_LEVEL >= LEVELS.info)
      console.log(`[${timestamp()}] ℹ️  INFO:`, ...args);
  },
  debug: (...args) => {
    if (CURRENT_LEVEL >= LEVELS.debug)
      console.log(`[${timestamp()}] 🔍 DEBUG:`, ...args);
  },
};

module.exports = logger;

/**
 * Centralized Configuration
 * Loads environment variables with sensible defaults.
 */
require('dotenv').config();

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'default-secret-change-me',
  API_KEY: process.env.API_KEY || 'default-api-key',
  ADMIN_USERNAME: process.env.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
  DUPLICATE_WINDOW_MINUTES: parseInt(process.env.DUPLICATE_WINDOW_MINUTES, 10) || 30,
  GOOGLE_SHEET_ID: process.env.GOOGLE_SHEET_ID || '',
  GOOGLE_CREDENTIALS_PATH: process.env.GOOGLE_CREDENTIALS_PATH || 'config/google-credentials.json',
};

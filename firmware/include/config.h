#ifndef CONFIG_H
#define CONFIG_H

// ─── WiFi Configuration ─────────────────────────────────────
#define WIFI_SSID          "YOUR_WIFI_SSID"
#define WIFI_PASSWORD      "YOUR_WIFI_PASSWORD"

// ─── Backend Server ─────────────────────────────────────────
#define SERVER_URL         "http://192.168.1.100:3000/api/rfid/scan"
#define API_KEY            "RFID-DEVICE-KEY-2024-CHANGE-ME"
#define DEVICE_ID          "DEVICE-01"

// ─── Hardware Pins ──────────────────────────────────────────
// MFRC522 RFID Reader (SPI)
#define RFID_SS_PIN        5
#define RFID_RST_PIN       22

// LCD 16x2 (I2C)
#define LCD_ADDRESS        0x27
#define LCD_COLS           16
#define LCD_ROWS           2

// LED Indicators
#define LED_SUCCESS        2    // Green LED (or built-in)
#define LED_ERROR          4    // Red LED

// Buzzer
#define BUZZER_PIN         15

// ─── Timing ─────────────────────────────────────────────────
#define CARD_DEBOUNCE_MS   3000   // Ignore same card for 3 seconds
#define WIFI_RETRY_DELAY   5000   // WiFi reconnect delay
#define HTTP_TIMEOUT_MS    10000  // HTTP request timeout
#define HTTP_RETRY_COUNT   3      // Number of retry attempts
#define HTTP_RETRY_DELAY   2000   // Delay between retries

#endif

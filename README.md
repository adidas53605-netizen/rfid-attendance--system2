# 📡 RFID Attendance Management System

A complete production-ready RFID-based Student Attendance Management System. This project includes ESP32 firmware for an RFID reader device, which communicates with a backend API to log student attendance.

## Features
- **RFID Scanning**: Uses MFRC522 to reliably read student ID cards
- **Real-time API Integration**: Posts attendance directly to your backend server
- **Offline Resilience**: Features HTTP retry mechanisms and WiFi auto-reconnect
- **Visual & Audio Feedback**:
  - 16x2 I2C LCD for real-time status and error messages
  - Green/Red LED indicators
  - Buzzer feedback for success and errors
- **Smart Debouncing**: Prevents multiple scans from the same card within a 3-second window
- **Secure Authentication**: Uses API keys for device-to-server communication

## System Architecture
```text
[ RFID Card ] --> (RF) --> [ MFRC522 Reader ]
                                | (SPI)
                                v
[ 16x2 LCD ] <--- (I2C) --- [ ESP32 Microcontroller ] ---> (Status LEDs & Buzzer)
                                |
                                | (WiFi / HTTP POST)
                                v
                      [ Backend Node.js API ]
                                |
                                v
                      [ Database / Google Sheets ]
```

## Prerequisites
- Node.js 18+
- npm
- ESP32 development board (e.g., ESP32-WROOM-32)
- MFRC522 RFID reader module
- LCD 16x2 with I2C backpack
- LEDs (Green, Red), Buzzer, Resistors
- PlatformIO / Arduino IDE

## Quick Start
1. Clone or download this repository.
2. Run `npm install` to install backend dependencies.
3. Run `npm run dev` to start the backend server.
4. Open `http://localhost:3000` in your browser.
5. Login with default credentials: `admin` / `admin123`

## ESP32 Setup

### Wiring Diagram
| ESP32 Pin | Component | Pin / Detail |
|-----------|-----------|--------------|
| GPIO 5    | MFRC522   | SDA (SS)     |
| GPIO 18   | MFRC522   | SCK          |
| GPIO 23   | MFRC522   | MOSI         |
| GPIO 19   | MFRC522   | MISO         |
| GPIO 22   | MFRC522   | RST          |
| 3.3V      | MFRC522   | VCC          |
| GND       | MFRC522   | GND          |
| GPIO 21   | LCD (I2C) | SDA          |
| GPIO 22*  | LCD (I2C) | SCL          |
| 5V/VIN    | LCD (I2C) | VCC          |
| GND       | LCD (I2C) | GND          |
| GPIO 2    | LED       | Success (Green) + 330Ω |
| GPIO 4    | LED       | Error (Red) + 330Ω     |
| GPIO 15   | Buzzer    | Active Buzzer Positive |

*\* Note: GPIO 22 is shared between RFID RST and LCD SCL in this configuration. Depending on your board, you may want to map one of these to a different pin.*

### Firmware Upload
1. Open the `firmware/` directory in PlatformIO (VS Code).
2. Edit `firmware/include/config.h` with your WiFi credentials, Server URL, and API Key.
3. Connect your ESP32 via USB.
4. Click "Upload" in PlatformIO to compile and flash the firmware.

## Google Sheets Setup
1. Go to Google Cloud Console and create a new project.
2. Enable the **Google Sheets API** and **Google Drive API**.
3. Create a **Service Account**, generate a JSON key, and save it to the backend `config/` directory.
4. Create a new Google Sheet and share it with the service account email (Editor access).
5. Copy the Spreadsheet ID from the URL and update your backend `.env` file.

## API Documentation

| Method | Endpoint | Headers | Description |
|--------|----------|---------|-------------|
| POST | `/api/attendance/scan` | `Content-Type: application/json`<br>`X-API-Key: <key>` | Logs attendance for a specific RFID tag. Requires `rfid_uid` and `device_id` in body. |
| GET | `/api/students` | `Authorization: Bearer <token>` | Retrieves a list of all registered students. |
| POST | `/api/students/register`| `Authorization: Bearer <token>` | Registers a new student and links an RFID UID. |
| GET | `/api/attendance/report` | `Authorization: Bearer <token>` | Fetches daily or date-range attendance reports. |

## Testing with cURL
Test the attendance scanning endpoint manually:

```bash
curl -X POST http://localhost:3000/api/attendance/scan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: RFID-DEVICE-KEY-2024-CHANGE-ME" \
  -d '{"rfid_uid":"A1B2C3D4", "device_id":"DEVICE-01"}'
```

## Default Seed Data

| Name | Roll Number | Department | RFID UID |
|------|-------------|------------|----------|
| Alice Smith | CS-01 | Computer Science | A1B2C3D4 |
| Bob Jones | EE-14 | Electrical Eng | E5F6G7H8 |
| Charlie Brown | ME-22 | Mechanical Eng | 9I0J1K2L |

## Project Structure
```text
antigravity/
├── firmware/                 # ESP32 Source Code
│   ├── include/
│   │   └── config.h          # Configuration file
│   ├── src/
│   │   └── main.cpp          # Main logic
│   └── platformio.ini        # Build configuration
├── backend/                  # Node.js API (if applicable)
├── frontend/                 # Web Dashboard
└── README.md                 # Project Documentation
```

## Security
- **API Keys**: Device-to-Server communication is secured via `X-API-Key`.
- **JWT Authentication**: Web dashboard uses JSON Web Tokens for user sessions.
- **Input Validation**: API validates all incoming RFID and Device IDs.
- **Environment Variables**: Sensitive keys and database URLs are stored securely in `.env`.

## Troubleshooting

- **LCD is blank or showing blocks**: Adjust the contrast potentiometer on the back of the I2C module. Ensure it's receiving 5V.
- **"Network Error!" on LCD**: Check your `config.h` WiFi credentials and ensure the `SERVER_URL` is accessible from the ESP32's network.
- **RFID not reading cards**: Verify SPI wiring. Ensure the MFRC522 is powered with exactly 3.3V, not 5V.
- **ESP32 Restarting Loop**: Check your power supply. The ESP32 requires a stable power source, especially when connecting to WiFi.

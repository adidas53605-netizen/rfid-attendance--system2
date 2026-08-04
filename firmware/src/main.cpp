#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ArduinoJson.h>
#include <LiquidCrystal_I2C.h>
#include "config.h"

// Hardware instances
MFRC522 mfrc522(RFID_SS_PIN, RFID_RST_PIN);
LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLS, LCD_ROWS);

// State variables
String lastUID = "";
unsigned long lastReadTime = 0;

// Function prototypes
void connectWiFi();
String getCardUID();
bool sendAttendance(String uid, String &responseBody, int &httpCode);
void displayIdle();
void displaySuccess(String name);
void displayError(String msg);
void beepSuccess();
void beepError();
void blinkLED(int pin, int times, int duration);

void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);
  
  Serial.println("\n--- RFID Attendance System ---");

  // Init pins
  pinMode(LED_SUCCESS, OUTPUT);
  pinMode(LED_ERROR, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  digitalWrite(LED_SUCCESS, LOW);
  digitalWrite(LED_ERROR, LOW);
  digitalWrite(BUZZER_PIN, LOW);

  // Init LCD
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("System Starting");

  // Init SPI & RFID
  SPI.begin();
  mfrc522.PCD_Init();
  delay(4); // Optional delay for PCD_Init
  
  // Init WiFi
  connectWiFi();
  
  displayIdle();
}

void loop() {
  // 1. Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi lost. Reconnecting...");
    lcd.clear();
    lcd.print("WiFi Disconnected");
    connectWiFi();
    displayIdle();
  }

  // 2. Check for new RFID card
  if (!mfrc522.PICC_IsNewCardPresent()) {
    return;
  }
  if (!mfrc522.PICC_ReadCardSerial()) {
    return;
  }

  // 3. Read UID
  String uid = getCardUID();
  
  // Halt PICC to stop reading the same card repeatedly in a loop immediately
  mfrc522.PICC_HaltA();
  mfrc522.PCD_StopCrypto1();

  // 4. Check debounce
  unsigned long currentTime = millis();
  if (uid == lastUID && (currentTime - lastReadTime < CARD_DEBOUNCE_MS)) {
    Serial.println("Card debounced (read too soon).");
    return;
  }
  
  lastUID = uid;
  lastReadTime = currentTime;
  
  Serial.print("Card detected! UID: ");
  Serial.println(uid);

  // 5. Display "Reading..."
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Reading Card...");
  
  // 6. POST to server
  String responseBody;
  int httpCode = 0;
  bool success = sendAttendance(uid, responseBody, httpCode);
  
  // 7 & 8. Parse response and display
  if (success) {
    // Parse JSON
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, responseBody);
    
    if (error) {
      Serial.print("deserializeJson() failed: ");
      Serial.println(error.c_str());
      displayError("JSON Error");
      beepError();
    } else {
      bool isSuccess = doc["success"] | false;
      
      if (isSuccess) {
        String studentName = doc["student"]["name"] | "Student";
        displaySuccess(studentName);
        beepSuccess();
        blinkLED(LED_SUCCESS, 1, 500);
      } else {
        String message = doc["message"] | "Unknown Error";
        displayError(message);
        beepError();
        blinkLED(LED_ERROR, 2, 200);
      }
    }
  } else {
    // HTTP failed completely after retries
    displayError("Network Error!");
    beepError();
    blinkLED(LED_ERROR, 3, 200);
  }
  
  // 9. Wait a bit, then return to idle display
  delay(2000);
  displayIdle();
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);
  
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    attempts++;
    
    // Update LCD with dots
    if (attempts % 4 == 0) {
      lcd.setCursor(0, 1);
      lcd.print("    "); // clear dots
    }
    lcd.setCursor((attempts % 4), 1);
    lcd.print(".");
    
    if (attempts > 40) { // 20 seconds
      Serial.println("\nWiFi connect failed. Restarting...");
      ESP.restart();
    }
  }
  
  Serial.println("\nWiFi connected!");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());
}

String getCardUID() {
  String uidStr = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) {
      uidStr += "0";
    }
    uidStr += String(mfrc522.uid.uidByte[i], HEX);
  }
  uidStr.toUpperCase();
  return uidStr;
}

bool sendAttendance(String uid, String &responseBody, int &httpCode) {
  if (WiFi.status() != WL_CONNECTED) {
    return false;
  }
  
  HTTPClient http;
  
  // Create JSON payload
  JsonDocument doc;
  doc["rfid_uid"] = uid;
  doc["device_id"] = DEVICE_ID;
  String payload;
  serializeJson(doc, payload);
  
  for (int attempt = 1; attempt <= HTTP_RETRY_COUNT; attempt++) {
    Serial.printf("HTTP POST Attempt %d/%d\n", attempt, HTTP_RETRY_COUNT);
    
    http.begin(SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-Key", API_KEY);
    http.setTimeout(HTTP_TIMEOUT_MS);
    
    httpCode = http.POST(payload);
    
    if (httpCode > 0) {
      Serial.printf("HTTP Response code: %d\n", httpCode);
      responseBody = http.getString();
      Serial.println("Response: " + responseBody);
      http.end();
      return true; // Return true as long as we got a response from server
    } else {
      Serial.printf("HTTP GET... failed, error: %s\n", http.errorToString(httpCode).c_str());
      http.end();
      
      if (attempt < HTTP_RETRY_COUNT) {
        Serial.println("Retrying...");
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Network Error!");
        lcd.setCursor(0, 1);
        lcd.print("Retrying...");
        delay(HTTP_RETRY_DELAY);
      }
    }
  }
  
  return false;
}

void displayIdle() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("RFID Attendance");
  lcd.setCursor(0, 1);
  lcd.print("Tap Your Card");
}

void displaySuccess(String name) {
  lcd.clear();
  lcd.setCursor(0, 0);
  // Truncate name if too long
  if (name.length() > 16) {
    name = name.substring(0, 16);
  }
  lcd.print(name);
  lcd.setCursor(0, 1);
  lcd.print("Marked!");
}

void displayError(String msg) {
  lcd.clear();
  // Split message to two lines if needed or just show first 16 chars
  if (msg.length() > 16) {
    lcd.setCursor(0, 0);
    lcd.print(msg.substring(0, 16));
    lcd.setCursor(0, 1);
    lcd.print(msg.substring(16, min((unsigned int)msg.length(), 32u)));
  } else {
    lcd.setCursor(0, 0);
    lcd.print(msg);
    lcd.setCursor(0, 1);
    lcd.print("Error");
  }
}

void beepSuccess() {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(BUZZER_PIN, LOW);
}

void beepError() {
  digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(BUZZER_PIN, LOW);
  delay(100);
  digitalWrite(BUZZER_PIN, HIGH);
  delay(100);
  digitalWrite(BUZZER_PIN, LOW);
}

void blinkLED(int pin, int times, int duration) {
  for (int i = 0; i < times; i++) {
    digitalWrite(pin, HIGH);
    delay(duration);
    digitalWrite(pin, LOW);
    if (i < times - 1) delay(duration);
  }
}

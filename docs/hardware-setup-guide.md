# KeyPass — Hardware Setup Guide (ESP32 + PN532 NFC Reader)

## Required Components

| Component | Model | Quantity | Notes |
|-----------|-------|----------|-------|
| ESP32 Dev Board | ESP32-WROOM-32 or ESP32-S3 | 1 per door | Wi-Fi + Bluetooth |
| NFC Reader | PN532 module | 1 per door | Must support SPI or I2C |
| Relay Module | 5V 1-channel | 1 per door | Controls electric door lock |
| Electric Lock | 12V electric strike / magnetic lock | 1 per door | Normally closed (NC) recommended |
| Power Supply | 12V 2A | 1 per door | Powers lock + ESP32 (via regulator) |
| Jumper Wires | Male-to-Female | ~10 | For connecting modules |
| USB Cable | Micro-USB or USB-C | 1 | For flashing ESP32 |

## Wiring Diagram

### ESP32 ↔ PN532 (SPI Mode)

```
PN532           ESP32
─────           ─────
VCC  ────────── 3.3V
GND  ────────── GND
SCK  ────────── GPIO 18 (SCK)
MISO ────────── GPIO 19 (MISO)
MOSI ────────── GPIO 23 (MOSI)
SS   ────────── GPIO 5  (CS)
IRQ  ────────── GPIO 4  (optional, for interrupt)
```

**Important**: Set PN532 DIP switches to SPI mode:
- Switch 1: OFF
- Switch 2: ON

### ESP32 ↔ Relay

```
Relay           ESP32
─────           ─────
VCC  ────────── 5V (VIN)
GND  ────────── GND
IN   ────────── GPIO 26
```

### Relay ↔ Door Lock

```
Relay NO (Normally Open) ── Lock terminal 1
Relay COM (Common)       ── 12V power supply +
Lock terminal 2          ── 12V power supply -
```

### Full Wiring Summary

```
                    ┌──────────┐
    3.3V ──────────│ PN532    │
    GND  ──────────│ NFC      │
    GPIO18 ────────│ SCK      │
    GPIO19 ────────│ MISO     │
    GPIO23 ────────│ MOSI     │
    GPIO5  ────────│ SS       │
                    └──────────┘

                    ┌──────────┐
    5V (VIN) ──────│ Relay    │──── Door Lock
    GND  ──────────│          │──── 12V Supply
    GPIO26 ────────│ IN       │
                    └──────────┘

    USB ───────────── ESP32 (for flashing & serial monitor)
```

## ESP32 Firmware

### Prerequisites

- Install [PlatformIO](https://platformio.org/) or Arduino IDE
- Install libraries:
  - `Adafruit PN532` (NFC)
  - `PubSubClient` (MQTT)
  - `ArduinoJson`
  - `WiFi` (built-in)

### Firmware Overview

The ESP32 firmware does:

1. Connect to Wi-Fi
2. Connect to MQTT broker
3. Subscribe to command topics
4. Wait for NFC card tap
5. On tap: exchange APDU commands with phone
6. Send credential + signature to server via MQTT
7. Server verifies → sends unlock command
8. ESP32 triggers relay for 3 seconds

### Configuration

Create `config.h` on the ESP32:

```cpp
// Wi-Fi
#define WIFI_SSID     "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"

// MQTT
#define MQTT_HOST     "your-server-ip-or-domain"
#define MQTT_PORT     1883
#define MQTT_USER     ""  // leave empty if no auth
#define MQTT_PASS     ""

// Device
#define DEVICE_ID     "ESP32-DOOR-001"  // unique per door
#define DOOR_ID       "uuid-from-dashboard"  // from the admin dashboard

// Pins
#define NFC_SS_PIN    5
#define RELAY_PIN     26
#define UNLOCK_MS     3000  // how long door stays open
```

### Flashing

```bash
# Using PlatformIO
cd esp32-firmware
pio run --target upload

# Or using Arduino IDE:
# 1. Open keypass-firmware.ino
# 2. Select board: ESP32 Dev Module
# 3. Select port: /dev/cu.usbserial-xxxx (Mac) or COM3 (Windows)
# 4. Click Upload
```

### Serial Monitor

```bash
# PlatformIO
pio device monitor --baud 115200

# Arduino IDE: Tools → Serial Monitor → 115200 baud
```

Expected output on boot:
```
[KeyPass] Starting...
[KeyPass] WiFi connecting to: your-wifi-name
[KeyPass] WiFi connected! IP: 192.168.1.100
[KeyPass] MQTT connecting to: your-server:1883
[KeyPass] MQTT connected!
[KeyPass] Subscribed to: keypass/ESP32-DOOR-001/command/#
[KeyPass] NFC reader initialized (PN532 firmware: 1.6)
[KeyPass] Ready — waiting for NFC tap...
```

## NFC Communication Flow

When a phone is tapped on the reader:

```
Step 1: ESP32 detects NFC target
  → Logs: [NFC] Card detected

Step 2: SELECT AID
  ESP32 sends: 00 A4 04 00 08 F04B455950415353
  Phone responds: 90 00 (OK)
  → Logs: [NFC] KeyPass AID selected

Step 3: GET CREDENTIAL
  ESP32 sends: 80 CA 00 00 00
  Phone responds: {16 bytes credential_id} + 90 00
  → Logs: [NFC] Credential ID: c1241677-1e80-41f5-...

Step 4: AUTHENTICATE
  ESP32 generates 32-byte random challenge
  ESP32 sends: 80 88 00 00 20 {challenge}
  Phone signs with Ed25519 private key
  Phone responds: {16 bytes credential_id} + {64 bytes signature} + 90 00
  → Logs: [NFC] Signature received (64 bytes)

Step 5: VERIFY via MQTT
  ESP32 publishes to: keypass/{device_id}/event
  Payload: { credential_id, challenge, signature }
  → Logs: [MQTT] Sent verification request

Step 6: SERVER RESPONSE
  Server verifies Ed25519 signature against stored public key
  Server publishes to: keypass/{device_id}/command/unlock
  → Logs: [MQTT] Unlock command received

Step 7: UNLOCK
  ESP32 activates relay for 3 seconds
  → Logs: [RELAY] Door unlocked for 3000ms
  → Logs: [RELAY] Door locked
```

## Testing Steps

### Step 1: Basic Hardware Test

1. Power on ESP32 via USB
2. Open serial monitor
3. Verify Wi-Fi connection
4. Verify MQTT connection
5. Verify NFC reader detected

### Step 2: NFC Communication Test

1. Open KeyPass app on registered phone
2. Hold phone against PN532 reader (within 2cm)
3. Watch serial monitor for APDU exchange
4. Verify credential ID is received
5. Verify signature is received

### Step 3: End-to-End Test

1. Ensure server is running with the door configured
2. Door must be added in admin dashboard with matching `esp_device_id`
3. User must have permission for this door
4. Tap phone → watch serial monitor → check admin dashboard logs

### Step 4: Relay Test

1. Connect relay to a LED first (instead of door lock)
2. Tap phone → LED should light for 3 seconds
3. Once confirmed, connect to real electric lock

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "NFC reader not found" | Wiring issue or wrong SPI mode | Check wires, verify PN532 DIP switches |
| "WiFi connection failed" | Wrong SSID/password or out of range | Double-check credentials, move closer to router |
| "MQTT connection failed" | Server not reachable or wrong port | Check server IP, firewall, MQTT port (1883) |
| "No NFC target detected" | Phone too far from reader | Hold phone within 1-2cm, try different orientation |
| "AID not selected (6A 82)" | App not installed or not registered | Verify KeyPass app is installed and registered |
| "Signature verification failed" | Wrong public key or expired credential | Check credential is active in database |
| "Relay doesn't click" | Wrong GPIO pin or relay power issue | Check wiring, try different GPIO |
| "Door lock doesn't open" | Relay wiring or power supply issue | Check NO/COM connections, verify 12V supply |

## Pin Reference

```
ESP32-WROOM-32 Pin Layout:

        ┌───────────────┐
   3.3V │ 3V3       VIN │ 5V
    GND │ GND       GND │ GND
GPIO 15 │ D15       D13 │ GPIO 13
GPIO  2 │ D2        D12 │ GPIO 12
GPIO  4 │ D4  ESP32 D14 │ GPIO 14
GPIO 16 │ RX2       D27 │ GPIO 27
GPIO 17 │ TX2       D26 │ GPIO 26  ← RELAY
GPIO  5 │ D5        D25 │ GPIO 25  ← NFC CS
GPIO 18 │ D18       D33 │ GPIO 33  ← NFC SCK
GPIO 19 │ D19       D32 │ GPIO 32  ← NFC MISO
GPIO 21 │ D21       D35 │ GPIO 35
GPIO  3 │ RX0       D34 │ GPIO 34
GPIO  1 │ TX0       VN  │ GPIO 39
GPIO 22 │ D22       VP  │ GPIO 36
GPIO 23 │ D23       EN  │ ENABLE   ← NFC MOSI
        └───────────────┘
```

# KeyPass — מערכת בקרת כניסה מבוססת NFC וטלפון נייד

## סקירה

KeyPass היא מערכת SaaS לבקרת כניסה שמאפשרת למנהלי בניינים ומשרדים לנהל גישה דיגיטלית באמצעות NFC בטלפון נייד.

### מבנה הפרויקט

```
keypass/
├── backend/          # Node.js + Express + TypeScript API
├── dashboard/        # Admin Dashboard (React + Vite)
├── super-dashboard/  # Super Admin Dashboard (React + Vite)
├── android/          # Android App (Kotlin + Jetpack Compose + NFC HCE)
├── mqtt/             # Mosquitto MQTT broker config
└── docker-compose.yml
```

## התקנה מהירה

### דרישות מקדימות
- Docker & Docker Compose
- Node.js 18+ (לפיתוח מקומי)
- Android Studio (לפיתוח האפליקציה)

### הפעלה עם Docker

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start all services
docker compose up --build

# 3. Run database migration & seed
docker compose exec api npm run db:push
docker compose exec api npm run seed
```

### כתובות

| Service | URL |
|---------|-----|
| API | http://localhost:3000 |
| Admin Dashboard | http://localhost:5173 |
| Super Admin Dashboard | http://localhost:5174 |
| Registration Page | http://localhost:3000/register?token=xxx |
| MQTT Broker | localhost:1883 |
| PostgreSQL | localhost:5432 |

### חשבונות ברירת מחדל

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@keypass.co.il | admin123456 |
| Demo Admin | demo@keypass.co.il | demo123456 |

## פיתוח מקומי

### Backend

```bash
cd backend
npm install
npm run dev
```

### Admin Dashboard

```bash
cd dashboard
npm install
npm run dev
```

### Super Admin Dashboard

```bash
cd super-dashboard
npm install
npm run dev
```

### Android App

```bash
cd android
./gradlew assembleDebug
# APK output: app/build/outputs/apk/debug/app-debug.apk
```

## API Endpoints

### Auth
- `POST /api/auth/super-admin/login` — Super admin login
- `POST /api/auth/admin/login` — Admin login
- `POST /api/auth/verify-token` — Start mobile registration
- `POST /api/auth/verify-otp` — Verify OTP
- `POST /api/auth/register-device` — Register mobile device
- `POST /api/auth/mobile/login` — Mobile re-login
- `POST /api/auth/refresh` — Refresh JWT

### Registration Page
- `GET /register?token=xxx` — Registration web page (mobile-friendly HTML)

### Super Admin
- `GET/POST /api/super/organizations` — Organizations CRUD
- `GET/POST /api/super/organizations/:orgId/admins` — Admins per org
- `GET /api/super/dashboard` — Dashboard stats
- `GET /api/super/devices` — All ESP32 devices
- `GET /api/super/activity-log` — Admin activity audit trail

### Admin
- `GET /api/admin/dashboard` — Dashboard with KPIs
- `GET/POST /api/admin/users` — Users CRUD
- `GET/POST /api/admin/doors` — Doors CRUD
- `POST /api/admin/doors/:id/unlock` — Remote unlock
- `GET/POST/DELETE /api/admin/permissions` — Door permissions
- `GET /api/admin/logs` — Access logs
- `GET/PUT /api/admin/settings` — Organization settings

### Mobile
- `GET /api/mobile/me` — Profile + assigned doors
- `GET /api/mobile/doors` — My doors
- `POST /api/mobile/doors/:id/prepare-unlock` — Get challenge
- `GET /api/mobile/history` — Access history

## Messaging

Messages are sent via **WhatsApp (Meta Business API)**. In `DEV_MODE=true`, messages are logged to console.

Required env vars:
- `WHATSAPP_TOKEN` — Meta API bearer token
- `WHATSAPP_PHONE_ID` — WhatsApp Business phone number ID

## NFC HCE (Host Card Emulation)

The Android app implements NFC HCE — when a user taps their phone on an NFC reader (ESP32 + PN532):

1. Reader selects KeyPass AID: `F04B455950415353`
2. Reader sends 32-byte challenge
3. Phone signs challenge with Ed25519 private key
4. Reader verifies signature → opens door

In `MOCK_NFC` mode (debug builds), a "Simulate NFC Tap" button is shown for testing without hardware.

## Tech Stack

- **Backend**: Node.js, Express, TypeScript, Drizzle ORM, PostgreSQL
- **Dashboards**: React, Vite, TailwindCSS, React Query, Socket.io
- **Android**: Kotlin, Jetpack Compose, Retrofit, lazysodium-android, NFC HCE
- **Messaging**: WhatsApp (Meta Business API)
- **Infrastructure**: Docker Compose, Mosquitto MQTT, nginx

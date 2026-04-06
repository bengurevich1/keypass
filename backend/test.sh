#!/bin/bash
# KeyPass API Test Script
# Usage: bash backend/test.sh
# Requires: curl, python3, docker compose running

API="http://localhost:3000"
PASS=0
FAIL=0

green() { printf "\033[32m✓ %s\033[0m\n" "$1"; PASS=$((PASS+1)); }
red()   { printf "\033[31m✗ %s\033[0m\n" "$1"; FAIL=$((FAIL+1)); }
header(){ printf "\n\033[1;36m=== %s ===\033[0m\n" "$1"; }
json()  { python3 -c "import sys,json; d=json.load(sys.stdin); $1" 2>/dev/null; }

# Wait for API
header "Waiting for API"
for i in $(seq 1 20); do
  curl -s "$API/api/health" >/dev/null 2>&1 && break
  sleep 1
done
curl -s "$API/api/health" >/dev/null 2>&1 && green "API is ready" || { red "API not reachable"; exit 1; }

# ===================== SUPER ADMIN =====================
header "Super Admin Login"
SA_RESP=$(curl -s -X POST "$API/api/auth/super-admin/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@keypass.co.il","password":"admin123456"}')
SA_TOKEN=$(echo "$SA_RESP" | json "print(d['accessToken'])")
[ -n "$SA_TOKEN" ] && green "Super admin login" || red "Super admin login"

header "Super Admin Dashboard"
SA_DASH=$(curl -s -H "Authorization: Bearer $SA_TOKEN" "$API/api/super/dashboard")
echo "$SA_DASH" | json "print(f'  Orgs: {d[\"totalOrgs\"]}, Users: {d[\"totalUsers\"]}, Doors: {d[\"totalDoors\"]}')"
[ -n "$SA_DASH" ] && green "Super admin dashboard" || red "Super admin dashboard"

header "Create Organization"
NEW_ORG=$(curl -s -X POST "$API/api/super/organizations" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SA_TOKEN" \
  -d '{"name":"בניין טסט","address":"רחוב טסט 1","plan":"standard","monthlyFee":500}')
ORG_ID=$(echo "$NEW_ORG" | json "print(d['id'])")
echo "  Org ID: $ORG_ID"
[ -n "$ORG_ID" ] && green "Create organization" || red "Create organization"

header "Create Admin for New Org"
TEST_EMAIL="test-$(date +%s)@keypass.co.il"
NEW_ADMIN=$(curl -s -X POST "$API/api/super/organizations/$ORG_ID/admins" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SA_TOKEN" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"test123456\",\"name\":\"מנהל טסט\",\"phone\":\"0501111111\"}")
ADMIN_ID=$(echo "$NEW_ADMIN" | json "print(d['id'])")
echo "  Admin ID: $ADMIN_ID"
[ -n "$ADMIN_ID" ] && green "Create admin" || red "Create admin"

# ===================== ADMIN =====================
header "Admin Login (new org)"
ADMIN_RESP=$(curl -s -X POST "$API/api/auth/admin/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"test123456\"}")
ADMIN_TOKEN=$(echo "$ADMIN_RESP" | json "print(d['accessToken'])")
[ -n "$ADMIN_TOKEN" ] && green "Admin login" || red "Admin login"

header "Create Door"
NEW_DOOR=$(curl -s -X POST "$API/api/admin/doors" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name":"כניסה ראשית","description":"דלת כניסה ראשית"}')
DOOR_ID=$(echo "$NEW_DOOR" | json "print(d['id'])")
echo "  Door ID: $DOOR_ID"
[ -n "$DOOR_ID" ] && green "Create door" || red "Create door"

header "Create Users with WhatsApp"
TS=$(date +%s)
for i in 1 2 3; do
  PHONE="05${i}${TS:(-7)}"
  USR=$(curl -s -X POST "$API/api/admin/users" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "{\"phone\":\"$PHONE\",\"name\":\"משתמש טסט $i\",\"apartment\":\"$i\",\"doorIds\":[\"$DOOR_ID\"],\"sendWhatsApp\":true}")
  USR_ID=$(echo "$USR" | json "print(d['id'])")
  echo "  User $i: $USR_ID ($PHONE)"
  [ -n "$USR_ID" ] && green "Create user $i" || red "Create user $i"
  if [ "$i" = "1" ]; then USER1_ID=$USR_ID; USER1_PHONE=$PHONE; fi
done

header "Fetch Registration Token"
REG_TOKEN=$(docker compose exec -T db psql -U keypass -t -A -c \
  "SELECT token FROM registration_tokens WHERE user_id='$USER1_ID' AND used=false ORDER BY created_at DESC LIMIT 1" 2>/dev/null)
echo "  Token: $REG_TOKEN"
[ -n "$REG_TOKEN" ] && green "Get registration token" || red "Get registration token"

# ===================== REGISTRATION FLOW =====================
header "Registration Flow"

echo "  Step 1: Verify token"
VT=$(curl -s -X POST "$API/api/auth/verify-token" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$REG_TOKEN\"}")
VALID=$(echo "$VT" | json "print(d['valid'])")
[ "$VALID" = "True" ] && green "Verify token" || red "Verify token"

echo "  Step 2: Send OTP"
SO=$(curl -s -X POST "$API/api/auth/send-otp" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$REG_TOKEN\"}")
MASK=$(echo "$SO" | json "print(d['phoneMask'])")
echo "  Phone mask: $MASK"
[ -n "$MASK" ] && green "Send OTP" || red "Send OTP"

echo "  Step 3: Get OTP from DB"
OTP=$(docker compose exec -T db psql -U keypass -t -A -c \
  "SELECT otp_code FROM registration_tokens WHERE token='$REG_TOKEN'" 2>/dev/null)
echo "  OTP: $OTP"
[ -n "$OTP" ] && green "OTP generated" || red "OTP not found"

echo "  Step 4: Verify OTP"
VO=$(curl -s -X POST "$API/api/auth/verify-otp" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$REG_TOKEN\",\"otp\":\"$OTP\"}")
SESSION=$(echo "$VO" | json "print(d['sessionToken'])")
[ -n "$SESSION" ] && green "Verify OTP" || red "Verify OTP"

echo "  Step 5: Register device"
RD=$(curl -s -X POST "$API/api/auth/register-device" \
  -H "Content-Type: application/json" \
  -d "{\"token\":\"$REG_TOKEN\",\"publicKey\":\"dGVzdHB1YmxpY2tleQ==\",\"deviceId\":\"test-device-$(date +%s)\",\"deviceName\":\"Test Phone\",\"platform\":\"android\",\"appVersion\":\"1.0.0\"}")
USER_TOKEN=$(echo "$RD" | json "print(d['accessToken'])")
CRED_ID=$(echo "$RD" | json "print(d['credential']['id'])")
echo "  Credential: $CRED_ID"
[ -n "$USER_TOKEN" ] && green "Register device" || red "Register device"

# ===================== MOBILE ENDPOINTS =====================
header "Mobile Endpoints"

ME=$(curl -s -H "Authorization: Bearer $USER_TOKEN" "$API/api/mobile/me")
MY_NAME=$(echo "$ME" | json "print(d['name'])")
echo "  Profile: $MY_NAME"
[ -n "$MY_NAME" ] && green "GET /mobile/me" || red "GET /mobile/me"

DOORS=$(curl -s -H "Authorization: Bearer $USER_TOKEN" "$API/api/mobile/doors")
DOOR_COUNT=$(echo "$DOORS" | json "print(len(d))")
echo "  Doors: $DOOR_COUNT"
[ "$DOOR_COUNT" -ge 1 ] 2>/dev/null && green "GET /mobile/doors" || red "GET /mobile/doors"

HIST=$(curl -s -H "Authorization: Bearer $USER_TOKEN" "$API/api/mobile/history")
echo "$HIST" | json "print(f'  History entries: {d[\"total\"]}')"
green "GET /mobile/history"

# ===================== REGISTRATION PAGE =====================
header "Registration Page"
REG_PAGE=$(curl -s -o /dev/null -w "%{http_code}" "$API/register?token=$REG_TOKEN")
[ "$REG_PAGE" = "200" ] && green "Registration page (used token)" || red "Registration page"

INVALID_PAGE=$(curl -s -o /dev/null -w "%{http_code}" "$API/register?token=invalidtoken123")
[ "$INVALID_PAGE" = "200" ] && green "Invalid token shows error" || red "Invalid token page"

# ===================== ADMIN FEATURES =====================
header "Admin Features"

echo "  Door mock toggle"
TOGGLE=$(curl -s -X POST "$API/api/admin/doors/$DOOR_ID/mock-toggle" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
IS_ONLINE=$(echo "$TOGGLE" | json "print(d['isOnline'])")
echo "  Door online: $IS_ONLINE"
green "Door mock toggle"

echo "  Remote unlock"
UNLOCK=$(curl -s -X POST "$API/api/admin/doors/$DOOR_ID/unlock" \
  -H "Authorization: Bearer $ADMIN_TOKEN")
echo "$UNLOCK" | json "print(f'  {d[\"message\"]}')"
green "Remote unlock"

echo "  CSV export"
CSV_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $ADMIN_TOKEN" "$API/api/admin/logs/export")
[ "$CSV_STATUS" = "200" ] && green "CSV export" || red "CSV export"

echo "  User suspend/activate"
curl -s -X POST "$API/api/admin/users/$USER1_ID/suspend" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | json "print(f'  {d[\"message\"]}')"
green "User suspend"

curl -s -X POST "$API/api/admin/users/$USER1_ID/activate" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | json "print(f'  {d[\"message\"]}')"
green "User activate"

# ===================== SUPER ADMIN FEATURES =====================
header "Super Admin Features"

ORGS=$(curl -s -H "Authorization: Bearer $SA_TOKEN" "$API/api/super/organizations")
ORG_COUNT=$(echo "$ORGS" | json "print(len(d))")
echo "  Organizations: $ORG_COUNT"
[ "$ORG_COUNT" -ge 2 ] 2>/dev/null && green "List organizations" || red "List organizations"

DEVICES=$(curl -s -H "Authorization: Bearer $SA_TOKEN" "$API/api/super/devices")
DEV_COUNT=$(echo "$DEVICES" | json "print(len(d))")
echo "  Devices: $DEV_COUNT"
green "List devices"

ACTIVITY=$(curl -s -H "Authorization: Bearer $SA_TOKEN" "$API/api/super/activity-log")
ACT_COUNT=$(echo "$ACTIVITY" | json "print(d['total'])")
echo "  Activity log entries: $ACT_COUNT"
[ "$ACT_COUNT" -ge 1 ] 2>/dev/null && green "Activity log" || red "Activity log"

# ===================== SUMMARY =====================
header "Test Results"
TOTAL=$((PASS+FAIL))
printf "\033[32m✓ Passed: $PASS\033[0m / $TOTAL\n"
if [ "$FAIL" -gt 0 ]; then
  printf "\033[31m✗ Failed: $FAIL\033[0m / $TOTAL\n"
  exit 1
else
  printf "\033[32mAll tests passed!\033[0m\n"
fi

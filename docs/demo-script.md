# KeyPass — Demo Video Script

> Duration: ~3 minutes
> Required: Computer with dashboards open, Android phone with KeyPass app

---

## Scene 1: Introduction (10 seconds)

**Show**: KeyPass logo / landing screen

**Script**: "KeyPass — מערכת בקרת כניסה חכמה מבוססת NFC. הטלפון הוא המפתח."

---

## Scene 2: Super Admin Creates Organization (30 seconds)

**Show**: Super Admin Dashboard (localhost:5174)

1. Login as super admin (`admin@keypass.co.il`)
2. Click "ארגון חדש"
3. Fill in: שם = "בניין המגדלים", כתובת = "רחוב הרצל 15, תל אביב"
4. Select plan: "רגיל"
5. Click "צור ארגון"

**Script**: "מנהל המערכת יוצר ארגון חדש — בניין, משרד, או כל מקום שצריך בקרת כניסה."

---

## Scene 3: Super Admin Adds Building Manager (20 seconds)

**Show**: Organization detail page

1. Click on the new organization
2. Go to "מנהלים" tab
3. Click "הוסף מנהל"
4. Fill in: name = "שרה כהן", email = "sarah@example.com", password
5. Click "הוסף מנהל"

**Script**: "מוסיפים מנהל בניין — הוא יקבל גישה לדשבורד הניהול שלו בלבד."

---

## Scene 4: Admin Dashboard — Adding a User (40 seconds)

**Show**: Admin Dashboard (localhost:5173)

1. Login as admin
2. Show the dashboard: KPI cards, door status
3. Go to "משתמשים" page
4. Click "הוסף משתמש"
5. Fill in: phone = real phone number, name = "אורן כהן", apartment = "12"
6. All doors are checked by default
7. "שלח הודעת WhatsApp" is checked
8. Click "הוסף משתמש"

**Script**: "מנהל הבניין מוסיף דייר. מזין טלפון, שם, ודירה. לוחץ שלח — הדייר מקבל הודעת WhatsApp."

---

## Scene 5: User Receives WhatsApp (20 seconds)

**Show**: Phone screen — WhatsApp notification

1. Show the WhatsApp message arriving
2. Message contains the registration link
3. User taps the link

**Script**: "הדייר מקבל הודעה ב-WhatsApp עם קישור. לוחץ — ומורידים את האפליקציה."

---

## Scene 6: App Installation & Registration (30 seconds)

**Show**: Phone screen

1. Link opens → /open page
2. APK downloads (or app opens directly if installed)
3. If first time: install the APK
4. App opens → spinner → "מאמת..." → "יוצר מפתח אבטחה..." → "✓ המפתח שלך מוכן!"
5. User taps "התחל להשתמש"
6. Home screen shows: "שלום, אורן" + door list

**Script**: "תוך 30 שניות — האפליקציה מותקנת, מפתח דיגיטלי נוצר, והדלתות מוכנות."

---

## Scene 7: Opening a Door (20 seconds)

**Show**: Phone held against NFC reader (or simulate button)

1. Show the door card with "סימולציית NFC" button
2. Tap the button
3. Button turns green: "✓ נפתח!"
4. Phone vibrates

**With real hardware** (when available):
1. Hold phone against reader next to door
2. Brief buzz/vibration
3. Door clicks open

**Script**: "הצמדה לקורא — הדלת נפתחת. בדיוק כמו תשלום בארנק דיגיטלי."

---

## Scene 8: Real-Time in Admin Dashboard (20 seconds)

**Show**: Split screen — phone + admin dashboard

1. Admin dashboard shows the access event appearing in real-time
2. Log entry: "אורן כהן | כניסה ראשית | NFC | נפתח"
3. Dashboard KPI updates

**Script**: "המנהל רואה בזמן אמת מי נכנס, לאיפה, ומתי. שליטה מלאה."

---

## Scene 9: Closing Summary (10 seconds)

**Show**: Dashboard overview with all KPIs

**Script**: "KeyPass — בקרת כניסה חכמה. NFC. WhatsApp. ללא מפתחות פיזיים. לבניינים, משרדים, וחללי עבודה."

---

## Recording Tips

- **Screen recording**: Use Android built-in recorder for phone, OBS for computer
- **Split screen**: Show phone + dashboard side by side for Scene 8
- **Speed up**: Fast-forward the APK download/install part (show it in 5x speed)
- **Background music**: Soft tech background music (royalty-free)
- **Resolution**: Record dashboards at 1920x1080, phone at native resolution
- **Hebrew RTL**: Make sure text is clearly readable (zoom in if needed)

## One-Liner for LinkedIn/Pitch

> "הטלפון שלך הוא המפתח. KeyPass — בקרת כניסה מבוססת NFC. מנהל הבניין מוסיף דייר בדשבורד, הדייר מקבל WhatsApp, מוריד אפליקציה, ומאותו רגע — הצמדת הטלפון פותחת את הדלת."

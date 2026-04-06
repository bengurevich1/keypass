import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { registrationTokens, users, organizations } from '../db/schema';
import { config } from '../config';

const router = Router();

// Favicon — return empty to avoid 404
router.get('/favicon.ico', (_req: Request, res: Response) => {
  res.status(204).end();
});

router.get('/', async (req: Request, res: Response) => {
  const token = req.query.token as string;

  let userName = '';
  let orgName = '';
  let validToken = false;

  if (token) {
    try {
      const [regToken] = await db.select().from(registrationTokens)
        .where(and(
          eq(registrationTokens.token, token),
          eq(registrationTokens.used, false),
        ));

      if (regToken && regToken.userId && new Date() < regToken.expiresAt) {
        validToken = true;
        const [user] = await db.select().from(users).where(eq(users.id, regToken.userId));
        if (user) {
          userName = user.name || '';
          if (user.orgId) {
            const [org] = await db.select().from(organizations).where(eq(organizations.id, user.orgId));
            orgName = org?.name || '';
          }
        }
      }
    } catch (err) {
      console.error('Registration page error:', err);
    }
  }

  const baseUrl = config.baseUrl;
  res.send(getRegistrationHTML(token, userName, orgName, validToken, baseUrl));
});

function getRegistrationHTML(token: string, userName: string, orgName: string, validToken: boolean, baseUrl: string): string {
  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="icon" href="data:,">
  <title>KeyPass — הרשמה</title>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Heebo', sans-serif;
      background: #fff;
      color: #1e293b;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 24px;
    }
    .container { width: 100%; max-width: 400px; text-align: center; }
    .logo {
      width: 80px; height: 80px; background: #ecfdf5; border-radius: 20px;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 24px; font-size: 40px;
    }
    h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
    .subtitle { color: #64748b; font-size: 16px; line-height: 1.6; margin-bottom: 32px; }
    .name { color: #059669; font-weight: 600; }
    .error-box {
      background: #fef2f2; color: #dc2626; padding: 12px 16px;
      border-radius: 12px; margin-bottom: 16px; font-size: 14px;
    }
    .success-box {
      background: #ecfdf5; color: #059669; padding: 12px 16px;
      border-radius: 12px; margin-bottom: 16px; font-size: 14px;
    }
    .btn {
      display: block; width: 100%; padding: 16px; border: none; border-radius: 12px;
      font-size: 18px; font-weight: 600; cursor: pointer;
      font-family: 'Heebo', sans-serif; transition: background 0.2s;
    }
    .btn-primary { background: #059669; color: #fff; }
    .btn-primary:hover { background: #047857; }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }
    .btn-secondary {
      background: #fff; color: #059669; border: 2px solid #059669; margin-top: 12px;
    }
    .btn-secondary:hover { background: #ecfdf5; }
    .btn-download {
      background: #059669; color: #fff; text-decoration: none;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .otp-container {
      display: flex; gap: 8px; justify-content: center;
      direction: ltr; margin-bottom: 16px;
    }
    .otp-input {
      width: 48px; height: 56px; border: 2px solid #e2e8f0; border-radius: 12px;
      font-size: 24px; font-weight: 700; text-align: center;
      font-family: 'Heebo', sans-serif; outline: none; transition: border-color 0.2s;
    }
    .otp-input:focus { border-color: #059669; background: #ecfdf5; }
    .timer { color: #94a3b8; font-size: 14px; margin-top: 12px; }
    .timer a { color: #059669; cursor: pointer; text-decoration: underline; }
    .step { display: none; }
    .step.active { display: block; }
    .spacer { height: 16px; }
    .loading { color: #64748b; font-size: 16px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="container">
    ${!validToken ? `
    <div class="logo">🔑</div>
    <h1>KeyPass</h1>
    <div class="error-box">קישור לא תקין או שפג תוקפו. בקש מהמנהל קישור חדש.</div>
    ` : `
    <!-- Step 1: Welcome -->
    <div id="step-welcome" class="step active">
      <div class="logo">🔑</div>
      <h1>ברוך הבא ל-KeyPass</h1>
      <p class="subtitle">
        שלום <span class="name">${userName}</span>,<br>
        הוזמנת להשתמש במערכת KeyPass${orgName ? ` ב${orgName}` : ''}.<br>
        לאימות, נשלח לך קוד ב-WhatsApp.
      </p>
      <div id="welcome-error" class="error-box" style="display:none"></div>
      <button id="btn-send-otp" class="btn btn-primary">שלח קוד</button>
    </div>

    <!-- Step 2: OTP -->
    <div id="step-otp" class="step">
      <h1>אימות</h1>
      <p class="subtitle" id="otp-subtitle">הזן את הקוד שנשלח אליך</p>
      <div id="otp-error" class="error-box" style="display:none"></div>
      <div class="otp-container" id="otp-container">
        <input class="otp-input" type="tel" maxlength="1" data-idx="0">
        <input class="otp-input" type="tel" maxlength="1" data-idx="1">
        <input class="otp-input" type="tel" maxlength="1" data-idx="2">
        <input class="otp-input" type="tel" maxlength="1" data-idx="3">
        <input class="otp-input" type="tel" maxlength="1" data-idx="4">
        <input class="otp-input" type="tel" maxlength="1" data-idx="5">
      </div>
      <div id="otp-loading" class="loading" style="display:none">מאמת...</div>
      <div class="timer" id="resend-timer"></div>
    </div>

    <!-- Step 3: Download -->
    <div id="step-download" class="step">
      <div class="logo" style="background:#ecfdf5;font-size:48px;">✓</div>
      <h1>אומת בהצלחה!</h1>
      <p class="subtitle">הורד את אפליקציית KeyPass והשלם את ההגדרה.</p>
      <div class="success-box">הקוד אומת — עכשיו פתח את האפליקציה להשלמת ההרשמה</div>
      <div class="spacer"></div>
      <a href="keypass://register?token=${token}" class="btn btn-primary btn-download">📱 פתח אפליקציה</a>
      <div class="spacer"></div>
      <a href="https://app.keypass.co.il/register?token=${token}" class="btn btn-secondary btn-download" style="border-color:#059669">🔗 פתח באפליקציה (deep link)</a>
      <div class="spacer"></div>
      <p class="subtitle" style="font-size:14px;">עדיין לא מותקנת?</p>
      <a href="#" class="btn btn-secondary" id="btn-download-apk">⬇️ הורד APK</a>
    </div>
    `}
  </div>

  <script>
    (function() {
      var TOKEN = '${token}';
      var API = '/api';
      var resendSeconds = 0;
      var resendInterval = null;
      var otpAttempts = 0;
      var MAX_OTP_ATTEMPTS = 3;

      function show(stepId) {
        document.querySelectorAll('.step').forEach(function(s) { s.classList.remove('active'); });
        document.getElementById(stepId).classList.add('active');
      }

      // ---- Step 1: Send OTP ----
      var btnSendOtp = document.getElementById('btn-send-otp');
      if (btnSendOtp) {
        btnSendOtp.addEventListener('click', function() {
          var btn = btnSendOtp;
          var errBox = document.getElementById('welcome-error');
          btn.disabled = true;
          btn.textContent = 'שולח...';
          errBox.style.display = 'none';

          fetch(API + '/auth/send-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: TOKEN })
          })
          .then(function(res) { return res.json().then(function(data) { return { ok: res.ok, data: data }; }); })
          .then(function(r) {
            if (!r.ok) throw new Error(r.data.error || 'שגיאה');
            document.getElementById('otp-subtitle').textContent =
              'הזן את הקוד שנשלח ל-' + (r.data.phoneMask || '');
            show('step-otp');
            document.querySelector('.otp-input').focus();
            setupOtpInputs();
            startResendTimer();
          })
          .catch(function(e) {
            errBox.textContent = e.message;
            errBox.style.display = 'block';
            btn.disabled = false;
            btn.textContent = 'שלח קוד';
          });
        });
      }

      // ---- Resend timer ----
      function startResendTimer() {
        resendSeconds = 60;
        updateTimerDisplay();
        if (resendInterval) clearInterval(resendInterval);
        resendInterval = setInterval(function() {
          resendSeconds--;
          updateTimerDisplay();
          if (resendSeconds <= 0) clearInterval(resendInterval);
        }, 1000);
      }

      function updateTimerDisplay() {
        var timerEl = document.getElementById('resend-timer');
        if (resendSeconds > 0) {
          timerEl.textContent = 'ניתן לשלוח שוב בעוד ' + resendSeconds + ' שניות';
        } else {
          timerEl.textContent = '';
          // Create a clickable link without inline onclick
          var link = document.createElement('a');
          link.textContent = 'שלח קוד מחדש';
          link.style.color = '#059669';
          link.style.cursor = 'pointer';
          link.style.textDecoration = 'underline';
          link.addEventListener('click', resendOtp);
          timerEl.appendChild(link);
        }
      }

      function resendOtp() {
        fetch(API + '/auth/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: TOKEN })
        })
        .then(function(res) {
          if (!res.ok) return res.json().then(function(d) { throw new Error(d.error || 'שגיאה'); });
          startResendTimer();
          document.querySelectorAll('.otp-input').forEach(function(i) { i.value = ''; });
          document.querySelector('.otp-input').focus();
        })
        .catch(function(e) {
          document.getElementById('otp-error').textContent = e.message;
          document.getElementById('otp-error').style.display = 'block';
        });
      }

      // ---- OTP inputs ----
      function setupOtpInputs() {
        var inputs = document.querySelectorAll('.otp-input');
        inputs.forEach(function(input, idx) {
          input.addEventListener('input', function() {
            if (input.value && idx < 5) inputs[idx + 1].focus();
            checkOtpComplete();
          });
          input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && !input.value && idx > 0) inputs[idx - 1].focus();
          });
        });
      }

      function checkOtpComplete() {
        var inputs = document.querySelectorAll('.otp-input');
        var otp = Array.from(inputs).map(function(i) { return i.value; }).join('');
        if (otp.length !== 6) return;

        if (otpAttempts >= MAX_OTP_ATTEMPTS) {
          document.getElementById('otp-error').textContent = 'חרגת ממספר הניסיונות המותרים';
          document.getElementById('otp-error').style.display = 'block';
          return;
        }

        otpAttempts++;
        var errBox = document.getElementById('otp-error');
        var loading = document.getElementById('otp-loading');
        errBox.style.display = 'none';
        loading.style.display = 'block';

        fetch(API + '/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: TOKEN, otp: otp })
        })
        .then(function(res) { return res.json().then(function(data) { return { ok: res.ok, data: data }; }); })
        .then(function(r) {
          if (!r.ok) throw new Error(r.data.error || 'קוד שגוי');
          show('step-download');
        })
        .catch(function(e) {
          errBox.textContent = e.message + (otpAttempts >= MAX_OTP_ATTEMPTS
            ? ' (מספר הניסיונות מוצה)'
            : ' (ניסיון ' + otpAttempts + '/' + MAX_OTP_ATTEMPTS + ')');
          errBox.style.display = 'block';
          loading.style.display = 'none';
          inputs.forEach(function(i) { i.value = ''; });
          if (otpAttempts < MAX_OTP_ATTEMPTS) inputs[0].focus();
        });
      }
    })();
  </script>
</body>
</html>`;
}

export default router;

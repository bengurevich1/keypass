import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import path from 'path';
import fs from 'fs';
import { db } from '../db';
import { registrationTokens, users, organizations } from '../db/schema';
import { config } from '../config';

const router = Router();

// ─── Helper: validate token without marking as used ───
async function validateToken(token: string): Promise<{ valid: boolean; userName: string; orgName: string }> {
  if (!token) return { valid: false, userName: '', orgName: '' };
  try {
    const [regToken] = await db.select().from(registrationTokens)
      .where(and(eq(registrationTokens.token, token), eq(registrationTokens.used, false)));
    if (!regToken || !regToken.userId || new Date() > regToken.expiresAt) {
      return { valid: false, userName: '', orgName: '' };
    }
    const [user] = await db.select().from(users).where(eq(users.id, regToken.userId));
    let orgName = '';
    if (user?.orgId) {
      const [org] = await db.select().from(organizations).where(eq(organizations.id, user.orgId));
      orgName = org?.name || '';
    }
    return { valid: true, userName: user?.name || '', orgName };
  } catch {
    return { valid: false, userName: '', orgName: '' };
  }
}

// ─── Helper: resolve APK path ───
function resolveApkPath(): string {
  const p = config.apkPath;
  return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
}

// ─── GET /open?token=xxx — smart redirect: try app deep link, fallback to download ───
router.get('/open', async (req: Request, res: Response) => {
  const token = req.query.token as string || '';
  const { valid, userName, orgName } = await validateToken(token);
  const apiBase = encodeURIComponent(config.baseUrl);
  const deepLink = `keypass://register?token=${token}&api=${apiBase}`;
  const downloadUrl = `${config.baseUrl}/download?token=${token}`;

  res.send(`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <link rel="icon" href="data:,">
  <title>KeyPass</title>
  <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Heebo',sans-serif;background:#fff;color:#1e293b;min-height:100vh;display:flex;justify-content:center;align-items:center;padding:24px}
    .c{width:100%;max-width:400px;text-align:center}
    .logo{width:80px;height:80px;background:#ecfdf5;border-radius:20px;display:flex;align-items:center;justify-content:center;margin:0 auto 24px;font-size:40px}
    h1{font-size:26px;font-weight:700;margin-bottom:8px}
    .sub{color:#64748b;font-size:15px;line-height:1.6;margin-bottom:24px}
    .name{color:#059669;font-weight:600}
    .btn{display:block;width:100%;padding:16px;border:none;border-radius:12px;font-size:17px;font-weight:600;cursor:pointer;font-family:'Heebo',sans-serif;text-decoration:none;text-align:center;margin-bottom:12px}
    .btn-green{background:#059669;color:#fff}
    .btn-green:hover{background:#047857}
    .btn-outline{background:#fff;color:#059669;border:2px solid #059669}
    .btn-outline:hover{background:#ecfdf5}
    .err{background:#fef2f2;color:#dc2626;padding:12px 16px;border-radius:12px;font-size:14px}
    .spinner{display:inline-block;width:24px;height:24px;border:3px solid #e2e8f0;border-top-color:#059669;border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
    @keyframes spin{to{transform:rotate(360deg)}}
    .hide{display:none}
    .step2{margin-top:24px;padding-top:24px;border-top:1px solid #e2e8f0}
    .wallet{margin-top:20px;padding-top:20px;border-top:1px solid #e2e8f0}
    .wallet .sub{margin-bottom:12px;font-size:13px}
    .btn-wallet{background:#000;color:#fff}
    .btn-wallet:hover{background:#1f2937}
  </style>
</head>
<body>
  <div class="c">
    ${!valid ? `
    <div class="logo">🔑</div>
    <h1>KeyPass</h1>
    <div class="err">הקישור פג תוקף או לא תקין. פנה למנהל הבניין.</div>
    ` : `
    <div class="logo">🔑</div>
    <h1>ברוך הבא ל-KeyPass</h1>
    <p class="sub">שלום <span class="name">${userName}</span>${orgName ? `, הוזמנת ל${orgName}` : ''}</p>

    <div id="phase-checking">
      <div class="spinner"></div>
      <p class="sub">בודק אם האפליקציה מותקנת...</p>
    </div>

    <div id="phase-download" class="hide">
      <a href="${downloadUrl}" class="btn btn-green" id="btn-download">⬇️ הורד את אפליקציית KeyPass</a>
      <p class="sub" style="font-size:13px;margin-top:8px">הקובץ בטוח — זו אפליקציית KeyPass לאנדרואיד</p>

      <div class="step2">
        <p class="sub" style="margin-bottom:16px">אחרי ההתקנה, לחץ כאן:</p>
        <a href="${deepLink}" class="btn btn-outline" id="btn-open">📱 פתח את KeyPass</a>
      </div>

      <div id="wallet-section" class="wallet hide">
        <p class="sub">או הוסף את הכרטיס לארנק:</p>
        <a id="btn-wallet" class="btn btn-wallet" href="#" target="_blank" rel="noopener"></a>
      </div>
    </div>
    `}
  </div>

  <script>
    (function(){
      var deepLink = '${deepLink}';
      var checking = document.getElementById('phase-checking');
      var download = document.getElementById('phase-download');
      if (!checking || !download) return;

      // Try to open the app via deep link
      var start = Date.now();
      var iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = deepLink;
      document.body.appendChild(iframe);

      // Also try window.location as backup for some Android browsers
      setTimeout(function() {
        window.location.href = deepLink;
      }, 100);

      // If we're still on this page after 2.5s, app is not installed
      setTimeout(function() {
        if (document.visibilityState !== 'hidden') {
          checking.classList.add('hide');
          download.classList.remove('hide');
        }
      }, 2500);

      // If page becomes hidden, the app opened successfully
      document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'hidden') {
          // App opened — do nothing, user is in the app
        }
      });
    })();

    // Wallet button: detect platform, fetch a signed wallet link, show appropriate CTA.
    (function(){
      var token = ${JSON.stringify(token)};
      if (!token) return;
      var ua = navigator.userAgent || '';
      var isIOS = /iPhone|iPad|iPod/i.test(ua);
      var isAndroid = /Android/i.test(ua);
      var platform = isIOS ? 'apple' : (isAndroid ? 'google' : null);
      if (!platform) return;
      fetch('/api/wallet/sign-from-registration?token=' + encodeURIComponent(token) + '&platform=' + platform)
        .then(function(r) { return r.ok ? r.json() : null; })
        .then(function(data) {
          if (!data || !data.url) return;
          var section = document.getElementById('wallet-section');
          var btn = document.getElementById('btn-wallet');
          if (!section || !btn) return;
          btn.href = data.url;
          btn.textContent = isIOS ? '🍎 הוסף ל-Apple Wallet' : '📱 הוסף ל-Google Wallet';
          section.classList.remove('hide');
        })
        .catch(function() { /* silent */ });
    })();
  </script>
</body>
</html>`);
});

// ─── GET /download?token=xxx — serve APK file ───
router.get('/download', async (req: Request, res: Response) => {
  const token = req.query.token as string || '';

  if (token) {
    const { valid } = await validateToken(token);
    if (!valid) {
      res.status(410).send(`<!DOCTYPE html>
<html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,"><title>KeyPass</title>
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:24px;background:#fff}
.c{text-align:center;max-width:400px}.err{background:#fef2f2;color:#dc2626;padding:16px;border-radius:12px;font-size:16px}</style>
</head><body><div class="c"><h2 style="margin-bottom:16px">🔑 KeyPass</h2>
<div class="err">הקישור פג תוקף. פנה למנהל הבניין לקבלת קישור חדש.</div></div></body></html>`);
      return;
    }
  }

  serveApk(res);
});

// ─── GET /download/latest — serve APK without token (for re-installs) ───
router.get('/download/latest', (_req: Request, res: Response) => {
  serveApk(res);
});

function serveApk(res: Response) {
  const apkPath = resolveApkPath();
  if (!fs.existsSync(apkPath)) {
    res.status(404).send(`<!DOCTYPE html>
<html lang="he" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:,"><title>KeyPass</title>
<style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:24px}
.c{text-align:center;max-width:400px}.err{background:#fef2f2;color:#dc2626;padding:16px;border-radius:12px;font-size:16px}</style>
</head><body><div class="c"><h2 style="margin-bottom:16px">🔑 KeyPass</h2>
<div class="err">קובץ האפליקציה עדיין לא זמין. נסה שוב מאוחר יותר.</div></div></body></html>`);
    return;
  }

  const stat = fs.statSync(apkPath);
  res.setHeader('Content-Type', 'application/vnd.android.package-archive');
  res.setHeader('Content-Disposition', 'attachment; filename="KeyPass.apk"');
  res.setHeader('Content-Length', stat.size);
  fs.createReadStream(apkPath).pipe(res);
}

export default router;

import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { superAdmins, admins, users, registrationTokens, credentials, organizations } from '../db/schema';
import { generateTokens, authenticate, JwtPayload } from '../middleware/auth';
import { validateBody } from '../middleware/validate';

import {
  superAdminLoginSchema,
  adminLoginSchema,
  verifyTokenSchema,
  verifyOtpSchema,
  registerDeviceSchema,
  refreshTokenSchema,
} from '../utils/validators';
import { sendOtpWhatsApp, generateOtp } from '../services/whatsapp';
import { generateToken } from '../services/crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';

const router = Router();

// Super Admin Login
router.post('/super-admin/login', validateBody(superAdminLoginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const [superAdmin] = await db.select().from(superAdmins)
      .where(and(eq(superAdmins.email, email), eq(superAdmins.isActive, true)));

    if (!superAdmin) {
      res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
      return;
    }

    const valid = await bcrypt.compare(password, superAdmin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
      return;
    }

    const payload: JwtPayload = { id: superAdmin.id, role: 'super_admin' };
    const tokens = generateTokens(payload);

    res.json({
      ...tokens,
      user: { id: superAdmin.id, email: superAdmin.email, name: superAdmin.name, role: 'super_admin' },
    });
  } catch (err) {
    console.error('Super admin login error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Admin Login
router.post('/admin/login', validateBody(adminLoginSchema), async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const [admin] = await db.select({
      admin: admins,
      orgName: organizations.name,
    }).from(admins)
      .innerJoin(organizations, eq(admins.orgId, organizations.id))
      .where(and(eq(admins.email, email), eq(admins.isActive, true)));

    if (!admin) {
      res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
      return;
    }

    const valid = await bcrypt.compare(password, admin.admin.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'אימייל או סיסמה שגויים' });
      return;
    }

    // Update last login
    await db.update(admins).set({ lastLoginAt: new Date() }).where(eq(admins.id, admin.admin.id));

    const payload: JwtPayload = { id: admin.admin.id, role: 'admin', orgId: admin.admin.orgId! };
    const tokens = generateTokens(payload);

    res.json({
      ...tokens,
      user: {
        id: admin.admin.id,
        email: admin.admin.email,
        name: admin.admin.name,
        role: admin.admin.role,
        orgId: admin.admin.orgId,
        orgName: admin.orgName,
      },
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Verify Token (validate registration token without sending OTP)
router.post('/verify-token', validateBody(verifyTokenSchema), async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    const [regToken] = await db.select().from(registrationTokens)
      .where(and(
        eq(registrationTokens.token, token),
        eq(registrationTokens.used, false),
      ));

    if (!regToken) {
      res.status(404).json({ error: 'טוקן לא נמצא או שכבר נוצל' });
      return;
    }

    if (new Date() > regToken.expiresAt) {
      res.status(410).json({ error: 'טוקן פג תוקף' });
      return;
    }

    const [user] = regToken.userId
      ? await db.select().from(users).where(eq(users.id, regToken.userId))
      : [];

    res.json({
      valid: true,
      userName: user?.name || '',
      phoneMask: user ? `${user.phone.slice(0, 3)}-XXX-XX${user.phone.slice(-2)}` : '',
    });
  } catch (err) {
    console.error('Verify token error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Send OTP via WhatsApp
router.post('/send-otp', validateBody(verifyTokenSchema), async (req: Request, res: Response) => {
  try {
    const { token } = req.body;

    const [regToken] = await db.select().from(registrationTokens)
      .where(and(
        eq(registrationTokens.token, token),
        eq(registrationTokens.used, false),
      ));

    if (!regToken) {
      res.status(404).json({ error: 'טוקן לא נמצא או שכבר נוצל' });
      return;
    }

    if (new Date() > regToken.expiresAt) {
      res.status(410).json({ error: 'טוקן פג תוקף' });
      return;
    }

    const otp = generateOtp();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await db.update(registrationTokens).set({
      otpCode: otp,
      otpExpiresAt,
      otpAttempts: 0,
    }).where(eq(registrationTokens.id, regToken.id));

    const [user] = regToken.userId
      ? await db.select().from(users).where(eq(users.id, regToken.userId))
      : [];

    let sent = false;
    if (user) {
      sent = await sendOtpWhatsApp(user.phone, otp);
    }

    if (sent) {
      res.json({
        message: 'קוד אימות נשלח',
        phoneMask: user ? `${user.phone.slice(0, 3)}-XXX-XX${user.phone.slice(-2)}` : '',
      });
    } else {
      res.status(502).json({ error: 'שליחת הודעת WhatsApp נכשלה. נסה שוב.' });
    }
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Verify OTP
router.post('/verify-otp', validateBody(verifyOtpSchema), async (req: Request, res: Response) => {
  try {
    const { token, otp } = req.body;

    const [regToken] = await db.select().from(registrationTokens)
      .where(and(
        eq(registrationTokens.token, token),
        eq(registrationTokens.used, false),
      ));

    if (!regToken) {
      res.status(404).json({ error: 'טוקן לא נמצא' });
      return;
    }

    if (!regToken.otpCode || !regToken.otpExpiresAt || new Date() > regToken.otpExpiresAt) {
      res.status(410).json({ error: 'קוד אימות פג תוקף' });
      return;
    }

    if ((regToken.otpAttempts || 0) >= 3) {
      res.status(429).json({ error: 'חרגת ממספר הניסיונות המותרים' });
      return;
    }

    if (regToken.otpCode !== otp) {
      await db.update(registrationTokens).set({
        otpAttempts: (regToken.otpAttempts || 0) + 1,
      }).where(eq(registrationTokens.id, regToken.id));
      res.status(400).json({ error: 'קוד אימות שגוי' });
      return;
    }

    // OTP valid - generate temp session token
    const sessionToken = generateToken(48);

    res.json({
      message: 'אומת בהצלחה',
      sessionToken,
      token,
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Register Device
router.post('/register-device', validateBody(registerDeviceSchema), async (req: Request, res: Response) => {
  try {
    const { token, publicKey, deviceId, deviceName, platform, appVersion } = req.body;

    const [regToken] = await db.select().from(registrationTokens)
      .where(and(
        eq(registrationTokens.token, token),
        eq(registrationTokens.used, false),
      ));

    if (!regToken || !regToken.userId) {
      res.status(404).json({ error: 'טוקן לא תקין או שכבר נוצל' });
      return;
    }

    if (new Date() > regToken.expiresAt) {
      res.status(410).json({ error: 'טוקן פג תוקף. בקש מהמנהל קישור חדש.' });
      return;
    }

    // Create credential
    const [credential] = await db.insert(credentials).values({
      userId: regToken.userId,
      publicKey,
      deviceId,
      deviceName,
      platform,
      appVersion,
    }).returning();

    // Mark token as used
    await db.update(registrationTokens).set({ used: true }).where(eq(registrationTokens.id, regToken.id));

    // Activate user
    await db.update(users).set({
      status: 'active',
      registeredAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(users.id, regToken.userId));

    // Get user info
    const [user] = await db.select().from(users).where(eq(users.id, regToken.userId));
    const [org] = user?.orgId ? await db.select().from(organizations).where(eq(organizations.id, user.orgId)) : [];

    // Generate JWT
    const payload: JwtPayload = { id: user.id, role: 'user', orgId: user.orgId!, credentialId: credential.id };
    const tokens = generateTokens(payload);

    res.json({
      ...tokens,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        orgName: org?.name,
      },
      credential: {
        id: credential.id,
      },
    });
  } catch (err) {
    console.error('Register device error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Mobile Login (challenge-response)
router.post('/mobile/login', async (req: Request, res: Response) => {
  try {
    const { credentialId, signedChallenge } = req.body;

    const [credential] = await db.select().from(credentials)
      .where(and(eq(credentials.id, credentialId), eq(credentials.isActive, true)));

    if (!credential || !credential.userId) {
      res.status(401).json({ error: 'מכשיר לא מזוהה' });
      return;
    }

    // In production, verify the signature against a stored challenge
    // For now, accept the credential if it exists and is active

    const [user] = await db.select().from(users).where(eq(users.id, credential.userId));
    if (!user || user.status !== 'active') {
      res.status(403).json({ error: 'המשתמש אינו פעיל' });
      return;
    }

    const payload: JwtPayload = { id: user.id, role: 'user', orgId: user.orgId!, credentialId: credential.id };
    const tokens = generateTokens(payload);

    res.json({ ...tokens });
  } catch (err) {
    console.error('Mobile login error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Refresh Token
router.post('/refresh', validateBody(refreshTokenSchema), async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as JwtPayload;
    const newTokens = generateTokens({ id: payload.id, role: payload.role, orgId: payload.orgId, credentialId: payload.credentialId });

    res.json(newTokens);
  } catch {
    res.status(401).json({ error: 'טוקן רענון לא תקין' });
  }
});

export default router;

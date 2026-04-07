import { Router, Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { registrationTokens, walletPasses } from '../db/schema';
import { authenticate, requireRole } from '../middleware/auth';
import {
  signWalletLink,
  verifyWalletLink,
  buildPublicWalletUrl,
  WalletPlatform,
} from '../wallet/linkToken';
import { generateSaveUrl, isGoogleWalletConfigured } from '../wallet/google';
import { buildPkpass, isAppleWalletConfigured } from '../wallet/apple';

const router = Router();

function isValidPlatform(p: unknown): p is WalletPlatform {
  return p === 'google' || p === 'apple';
}

async function recordIssued(userId: string, platform: WalletPlatform, externalId?: string) {
  try {
    // Drizzle does not yet have a clean upsert helper for arbitrary unique indexes
    // in this version, so do a check-then-insert. Race is harmless given the
    // unique index on (user_id, platform).
    const [existing] = await db
      .select()
      .from(walletPasses)
      .where(and(eq(walletPasses.userId, userId), eq(walletPasses.platform, platform)));
    if (existing) {
      if (externalId && existing.externalId !== externalId) {
        await db
          .update(walletPasses)
          .set({ externalId, revokedAt: null })
          .where(eq(walletPasses.id, existing.id));
      }
      return;
    }
    await db.insert(walletPasses).values({ userId, platform, externalId });
  } catch (err) {
    console.warn('walletPasses insert failed:', err);
  }
}

// ─── POST /api/wallet/sign — authenticated user requests a public wallet link ───
router.post('/sign', authenticate, requireRole('user'), async (req: Request, res: Response) => {
  const { platform } = req.body || {};
  if (!isValidPlatform(platform)) {
    res.status(400).json({ error: 'platform must be google or apple' });
    return;
  }
  const token = signWalletLink({ userId: req.user!.id, platform });
  res.json({ url: buildPublicWalletUrl(platform, token) });
});

// ─── GET /api/wallet/sign-from-registration?token=...&platform=... ───
// Used by the /open page (the user is mid-registration and only has the registration token)
router.get('/sign-from-registration', async (req: Request, res: Response) => {
  const regToken = (req.query.token as string) || '';
  const platform = req.query.platform;
  if (!isValidPlatform(platform)) {
    res.status(400).json({ error: 'platform must be google or apple' });
    return;
  }
  if (!regToken) {
    res.status(400).json({ error: 'registration token required' });
    return;
  }
  try {
    const [row] = await db
      .select()
      .from(registrationTokens)
      .where(eq(registrationTokens.token, regToken));
    if (!row || !row.userId || new Date() > row.expiresAt) {
      res.status(410).json({ error: 'registration token invalid or expired' });
      return;
    }
    const token = signWalletLink({ userId: row.userId, platform });
    res.json({ url: buildPublicWalletUrl(platform, token) });
  } catch (err) {
    console.error('sign-from-registration error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ─── GET /api/wallet/google?t=<linkToken> — public, redirects to pay.google.com ───
router.get('/google', async (req: Request, res: Response) => {
  if (!isGoogleWalletConfigured()) {
    res.status(503).json({ error: 'Google Wallet אינו מוגדר בשרת' });
    return;
  }
  const t = (req.query.t as string) || '';
  const payload = verifyWalletLink(t);
  if (!payload || payload.platform !== 'google') {
    res.status(401).send('Wallet link invalid or expired');
    return;
  }
  try {
    const saveUrl = await generateSaveUrl(payload.userId);
    await recordIssued(payload.userId, 'google');
    res.redirect(302, saveUrl);
  } catch (err) {
    console.error('Google Wallet generate error:', err);
    res.status(500).json({ error: 'שגיאה ביצירת הכרטיס' });
  }
});

// ─── GET /api/wallet/apple?t=<linkToken> — public, returns .pkpass ───
router.get('/apple', async (req: Request, res: Response) => {
  if (!isAppleWalletConfigured()) {
    res.status(503).json({ error: 'Apple Wallet אינו מוגדר בשרת' });
    return;
  }
  const t = (req.query.t as string) || '';
  const payload = verifyWalletLink(t);
  if (!payload || payload.platform !== 'apple') {
    res.status(401).send('Wallet link invalid or expired');
    return;
  }
  try {
    const buf = await buildPkpass(payload.userId);
    await recordIssued(payload.userId, 'apple', payload.userId);
    res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
    res.setHeader('Content-Disposition', 'attachment; filename="keypass.pkpass"');
    res.setHeader('Content-Length', buf.length.toString());
    res.end(buf);
  } catch (err) {
    console.error('Apple Wallet generate error:', err);
    res.status(500).json({ error: 'שגיאה ביצירת הכרטיס' });
  }
});

// ─── GET /api/wallet/status — used by clients to know which buttons to render ───
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    google: isGoogleWalletConfigured(),
    apple: isAppleWalletConfigured(),
  });
});

export default router;

import { Router, Request, Response } from 'express';
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../db';
import { users, doors, doorPermissions, accessLogs, credentials, organizations } from '../db/schema';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { updateProfileSchema, updateDeviceSchema } from '../utils/validators';
import { generateChallenge } from '../services/crypto';

const router = Router();

router.use(authenticate, requireRole('user'));

// Get profile + assigned doors
router.get('/me', async (req: Request, res: Response) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.id));
    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    const [org] = user.orgId ? await db.select().from(organizations).where(eq(organizations.id, user.orgId)) : [];

    const myDoors = await db.select({
      door: doors,
      permission: doorPermissions,
    }).from(doorPermissions)
      .innerJoin(doors, eq(doorPermissions.doorId, doors.id))
      .where(eq(doorPermissions.userId, user.id));

    res.json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      apartment: user.apartment,
      email: user.email,
      orgName: org?.name,
      doors: myDoors.map((d) => ({
        id: d.door.id,
        name: d.door.name,
        isOnline: d.door.isOnline,
        lastSeenAt: d.door.lastSeenAt,
      })),
    });
  } catch (err) {
    console.error('Get profile error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update profile
router.put('/me', validateBody(updateProfileSchema), async (req: Request, res: Response) => {
  try {
    const [user] = await db.update(users)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(users.id, req.user!.id))
      .returning();

    res.json({ name: user.name, email: user.email });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Get my doors
router.get('/doors', async (req: Request, res: Response) => {
  try {
    const myDoors = await db.select({
      door: doors,
    }).from(doorPermissions)
      .innerJoin(doors, eq(doorPermissions.doorId, doors.id))
      .where(eq(doorPermissions.userId, req.user!.id));

    // Get last access for each door
    const doorsWithHistory = await Promise.all(myDoors.map(async (d) => {
      const [lastAccess] = await db.select().from(accessLogs)
        .where(and(eq(accessLogs.doorId, d.door.id), eq(accessLogs.userId, req.user!.id)))
        .orderBy(desc(accessLogs.timestamp))
        .limit(1);

      return {
        id: d.door.id,
        name: d.door.name,
        description: d.door.description,
        isOnline: d.door.isOnline,
        lastSeenAt: d.door.lastSeenAt,
        lastAccess: lastAccess?.timestamp,
      };
    }));

    res.json(doorsWithHistory);
  } catch (err) {
    console.error('Get doors error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Prepare unlock (get challenge for BLE)
router.post('/doors/:id/prepare-unlock', async (req: Request, res: Response) => {
  try {
    // Verify user has permission to this door
    const [perm] = await db.select().from(doorPermissions)
      .where(and(
        eq(doorPermissions.userId, req.user!.id),
        eq(doorPermissions.doorId, req.params.id),
      ));

    if (!perm) {
      res.status(403).json({ error: 'אין הרשאה לדלת זו' });
      return;
    }

    // Check time restrictions
    if (perm.timeRestriction) {
      const restriction = perm.timeRestriction as { days: number[]; from: string; to: string };
      const now = new Date();
      const day = now.getDay();
      const time = now.toTimeString().slice(0, 5);

      if (restriction.days && !restriction.days.includes(day)) {
        res.status(403).json({ error: 'אין גישה ביום זה' });
        return;
      }
      if (restriction.from && time < restriction.from) {
        res.status(403).json({ error: 'אין גישה בשעה זו' });
        return;
      }
      if (restriction.to && time > restriction.to) {
        res.status(403).json({ error: 'אין גישה בשעה זו' });
        return;
      }
    }

    // Check valid_until
    if (perm.validUntil && new Date() > perm.validUntil) {
      res.status(403).json({ error: 'ההרשאה פגה תוקף' });
      return;
    }

    const challenge = generateChallenge();

    res.json({
      challenge,
      doorId: req.params.id,
      credentialId: req.user!.credentialId,
    });
  } catch (err) {
    console.error('Prepare unlock error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Mock NFC unlock (for testing without hardware)
router.post('/doors/:id/mock-unlock', async (req: Request, res: Response) => {
  try {
    const [perm] = await db.select().from(doorPermissions)
      .where(and(
        eq(doorPermissions.userId, req.user!.id),
        eq(doorPermissions.doorId, req.params.id),
      ));

    if (!perm) {
      res.status(403).json({ error: 'אין הרשאה לדלת זו' });
      return;
    }

    const [door] = await db.select().from(doors).where(eq(doors.id, req.params.id));

    // Log access
    await db.insert(accessLogs).values({
      orgId: req.user!.orgId,
      doorId: req.params.id,
      userId: req.user!.id,
      credentialId: req.user!.credentialId,
      action: 'unlock',
      method: 'nfc_mock',
      metadata: { mock: true },
    });

    // Emit real-time event
    const { emitToOrg } = await import('../services/notifications');
    const [user] = await db.select().from(users).where(eq(users.id, req.user!.id));
    emitToOrg(req.user!.orgId!, 'access:new_log', {
      doorId: req.params.id,
      doorName: door?.name,
      userId: req.user!.id,
      userName: user?.name,
      action: 'unlock',
      method: 'nfc_mock',
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: 'דלת נפתחה (סימולציה)' });
  } catch (err) {
    console.error('Mock unlock error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Access history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const history = await db.select({
      log: accessLogs,
      doorName: doors.name,
    }).from(accessLogs)
      .leftJoin(doors, eq(accessLogs.doorId, doors.id))
      .where(eq(accessLogs.userId, req.user!.id))
      .orderBy(desc(accessLogs.timestamp))
      .limit(limit)
      .offset(offset);

    const [total] = await db.select({ count: count() }).from(accessLogs)
      .where(eq(accessLogs.userId, req.user!.id));

    res.json({
      data: history.map((h) => ({ ...h.log, doorName: h.doorName })),
      total: total.count,
      page,
      limit,
    });
  } catch (err) {
    console.error('Get history error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Update device info
router.put('/device', validateBody(updateDeviceSchema), async (req: Request, res: Response) => {
  try {
    if (!req.user!.credentialId) {
      res.status(400).json({ error: 'מזהה מכשיר חסר' });
      return;
    }

    await db.update(credentials)
      .set(req.body)
      .where(eq(credentials.id, req.user!.credentialId));

    res.json({ message: 'פרטי מכשיר עודכנו' });
  } catch (err) {
    console.error('Update device error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Support message
router.post('/support', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    console.log(`📨 Support message from user ${req.user!.id}: ${message}`);
    res.json({ message: 'ההודעה נשלחה בהצלחה' });
  } catch (err) {
    console.error('Support error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Delete account
router.delete('/me', async (req: Request, res: Response) => {
  try {
    // Revoke all credentials
    await db.update(credentials)
      .set({ isActive: false, revokedAt: new Date() })
      .where(eq(credentials.userId, req.user!.id));

    // Set user status to revoked
    await db.update(users)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(eq(users.id, req.user!.id));

    res.json({ message: 'החשבון נמחק בהצלחה' });
  } catch (err) {
    console.error('Delete account error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;

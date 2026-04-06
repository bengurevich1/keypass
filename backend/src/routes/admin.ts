import { Router, Request, Response } from 'express';
import { eq, and, desc, sql, count, like, or } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import {
  users, doors, doorPermissions, accessLogs, credentials,
  registrationTokens, organizations, admins,
} from '../db/schema';
import { authenticate, requireRole } from '../middleware/auth';
import { orgScope } from '../middleware/orgScope';
import { validateBody } from '../middleware/validate';
import {
  createUserSchema, updateUserSchema, bulkCreateUsersSchema,
  createDoorSchema, updateDoorSchema,
  createPermissionSchema, bulkPermissionsSchema,
  updatePasswordSchema,
} from '../utils/validators';
import { logAdminActivity } from '../services/activityLog';
import { sendRegistrationWhatsApp } from '../services/whatsapp';
import { generateToken } from '../services/crypto';
import { publishUnlock, publishSync } from '../services/mqtt';
import { emitToOrg } from '../services/notifications';

const router = Router();

router.use(authenticate, requireRole('admin'), orgScope);

function getOrgId(req: Request): string {
  return req.user!.orgId!;
}

// ==================== DASHBOARD ====================

router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);

    const [totalUsers] = await db.select({ count: count() }).from(users).where(eq(users.orgId, orgId));
    const [activeUsers] = await db.select({ count: count() }).from(users).where(and(eq(users.orgId, orgId), eq(users.status, 'active')));
    const [totalDoors] = await db.select({ count: count() }).from(doors).where(eq(doors.orgId, orgId));
    const [onlineDoors] = await db.select({ count: count() }).from(doors).where(and(eq(doors.orgId, orgId), eq(doors.isOnline, true)));
    const [pendingUsers] = await db.select({ count: count() }).from(users).where(and(eq(users.orgId, orgId), eq(users.status, 'pending')));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayAccesses] = await db.select({ count: count() }).from(accessLogs)
      .where(and(eq(accessLogs.orgId, orgId), sql`${accessLogs.timestamp} >= ${today}`));

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [weekAccesses] = await db.select({ count: count() }).from(accessLogs)
      .where(and(eq(accessLogs.orgId, orgId), sql`${accessLogs.timestamp} >= ${weekAgo}`));

    const recentLogs = await db.select({
      log: accessLogs,
      userName: users.name,
      doorName: doors.name,
    }).from(accessLogs)
      .leftJoin(users, eq(accessLogs.userId, users.id))
      .leftJoin(doors, eq(accessLogs.doorId, doors.id))
      .where(eq(accessLogs.orgId, orgId))
      .orderBy(desc(accessLogs.timestamp))
      .limit(20);

    res.json({
      totalUsers: totalUsers.count,
      activeUsers: activeUsers.count,
      totalDoors: totalDoors.count,
      onlineDoors: onlineDoors.count,
      pendingRegistrations: pendingUsers.count,
      accessesToday: todayAccesses.count,
      accessesThisWeek: weekAccesses.count,
      recentLogs: recentLogs.map((r) => ({
        ...r.log,
        userName: r.userName,
        doorName: r.doorName,
      })),
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ==================== USERS ====================

router.get('/users', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const doorId = req.query.door_id as string;

    let conditions = [eq(users.orgId, orgId)];
    if (status) conditions.push(eq(users.status, status));
    if (search) {
      conditions.push(
        or(
          like(users.name, `%${search}%`),
          like(users.phone, `%${search}%`),
          like(users.apartment, `%${search}%`),
        )!
      );
    }

    let query = db.select().from(users)
      .where(and(...conditions))
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const userList = await query;

    // Get door permissions and names for each user
    const usersWithDoors = await Promise.all(userList.map(async (user) => {
      const perms = await db.select({
        doorId: doorPermissions.doorId,
        doorName: doors.name,
      }).from(doorPermissions)
        .innerJoin(doors, eq(doorPermissions.doorId, doors.id))
        .where(eq(doorPermissions.userId, user.id));

      // Get last access
      const [lastAccess] = await db.select().from(accessLogs)
        .where(and(eq(accessLogs.userId, user.id), eq(accessLogs.action, 'unlock')))
        .orderBy(desc(accessLogs.timestamp))
        .limit(1);

      return { ...user, doors: perms, lastAccess: lastAccess?.timestamp };
    }));

    // Filter by door if specified
    let filtered = usersWithDoors;
    if (doorId) {
      filtered = usersWithDoors.filter((u) => u.doors.some((d) => d.doorId === doorId));
    }

    const [total] = await db.select({ count: count() }).from(users).where(and(...conditions));

    res.json({ data: filtered, total: total.count, page, limit });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const userId = req.params.id as string;
    const [user] = await db.select().from(users)
      .where(and(eq(users.id, userId), eq(users.orgId, orgId)));

    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    const userCredentials = await db.select().from(credentials).where(eq(credentials.userId, user.id));
    const perms = await db.select({
      permission: doorPermissions,
      doorName: doors.name,
    }).from(doorPermissions)
      .innerJoin(doors, eq(doorPermissions.doorId, doors.id))
      .where(eq(doorPermissions.userId, user.id));

    const history = await db.select({
      log: accessLogs,
      doorName: doors.name,
    }).from(accessLogs)
      .leftJoin(doors, eq(accessLogs.doorId, doors.id))
      .where(eq(accessLogs.userId, user.id))
      .orderBy(desc(accessLogs.timestamp))
      .limit(50);

    res.json({
      ...user,
      credentials: userCredentials,
      permissions: perms.map((p) => ({ ...p.permission, doorName: p.doorName })),
      history: history.map((h) => ({ ...h.log, doorName: h.doorName })),
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.post('/users', validateBody(createUserSchema), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { phone, name, apartment, email, doorIds, sendWhatsApp, notes } = req.body;

    const [user] = await db.insert(users).values({
      orgId,
      phone,
      name,
      apartment,
      email,
      notes,
      status: 'pending',
    }).returning();

    // Assign doors
    if (doorIds && doorIds.length > 0) {
      await db.insert(doorPermissions).values(
        doorIds.map((doorId: string) => ({
          userId: user.id,
          doorId,
          grantedBy: req.user!.id,
        }))
      );
    }

    // Send WhatsApp (non-blocking — user is created even if WhatsApp fails)
    let whatsappSent = false;
    if (sendWhatsApp) {
      try {
        const token = generateToken(32);
        await db.insert(registrationTokens).values({
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        });

        const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
        whatsappSent = await sendRegistrationWhatsApp(phone, name || '', org?.name || '', token);
      } catch (waErr) {
        console.error('WhatsApp send failed (user still created):', waErr);
      }
    }

    await logAdminActivity({
      orgId,
      adminId: req.user!.id,
      adminType: 'admin',
      action: 'user_created',
      targetType: 'user',
      targetId: user.id,
      details: { phone, name },
    });

    emitToOrg(orgId, 'user:created', { userId: user.id, name: user.name });

    res.status(201).json(user);
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'מספר טלפון כבר קיים בארגון' });
      return;
    }
    console.error('Create user error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.put('/users/:id', validateBody(updateUserSchema), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const [user] = await db.update(users)
      .set({ ...req.body, updatedAt: new Date() })
      .where(and(eq(users.id, req.params.id), eq(users.orgId, orgId)))
      .returning();

    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    await logAdminActivity({
      orgId,
      adminId: req.user!.id,
      adminType: 'admin',
      action: 'user_updated',
      targetType: 'user',
      targetId: user.id,
      details: req.body,
    });

    res.json(user);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const [user] = await db.update(users)
      .set({ status: 'revoked', updatedAt: new Date() })
      .where(and(eq(users.id, req.params.id), eq(users.orgId, orgId)))
      .returning();

    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    // Revoke all credentials
    await db.update(credentials)
      .set({ isActive: false, revokedAt: new Date() })
      .where(eq(credentials.userId, user.id));

    await logAdminActivity({
      orgId,
      adminId: req.user!.id,
      adminType: 'admin',
      action: 'user_revoked',
      targetType: 'user',
      targetId: user.id,
    });

    emitToOrg(orgId, 'user:status_changed', { userId: user.id, newStatus: 'revoked' });

    res.json({ message: 'גישת המשתמש בוטלה' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Permanent delete (hard delete from DB)
router.delete('/users/:id/permanent', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);

    // Verify user belongs to this org
    const [user] = await db.select().from(users)
      .where(and(eq(users.id, req.params.id), eq(users.orgId, orgId)));

    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    // Delete in order: permissions, credentials, registration tokens, access logs refs, then user
    await db.delete(doorPermissions).where(eq(doorPermissions.userId, user.id));
    await db.delete(credentials).where(eq(credentials.userId, user.id));
    await db.delete(registrationTokens).where(eq(registrationTokens.userId, user.id));
    await db.delete(users).where(eq(users.id, user.id));

    await logAdminActivity({
      orgId,
      adminId: req.user!.id,
      adminType: 'admin',
      action: 'user_deleted_permanent',
      targetType: 'user',
      targetId: user.id,
      details: { name: user.name, phone: user.phone },
    });

    emitToOrg(orgId, 'user:deleted', { userId: user.id });

    res.json({ message: 'המשתמש נמחק לצמיתות' });
  } catch (err) {
    console.error('Permanent delete user error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.post('/users/:id/resend-whatsapp', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const [user] = await db.select().from(users)
      .where(and(eq(users.id, req.params.id), eq(users.orgId, orgId)));

    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    const token = generateToken(32);
    await db.insert(registrationTokens).values({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const sent = await sendRegistrationWhatsApp(user.phone, user.name || '', org?.name || '', token);

    await logAdminActivity({
      orgId,
      adminId: req.user!.id,
      adminType: 'admin',
      action: 'whatsapp_resent',
      targetType: 'user',
      targetId: user.id,
    });

    if (sent) {
      res.json({ message: 'הודעת WhatsApp נשלחה בהצלחה' });
    } else {
      res.json({ message: 'המשתמש נוצר אך שליחת WhatsApp נכשלה. נסה שוב מאוחר יותר.', whatsappFailed: true });
    }
  } catch (err) {
    console.error('Resend WhatsApp error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.post('/users/:id/suspend', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const [user] = await db.update(users)
      .set({ status: 'suspended', updatedAt: new Date() })
      .where(and(eq(users.id, req.params.id), eq(users.orgId, orgId)))
      .returning();

    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    await logAdminActivity({
      orgId,
      adminId: req.user!.id,
      adminType: 'admin',
      action: 'user_suspended',
      targetType: 'user',
      targetId: user.id,
    });

    emitToOrg(orgId, 'user:status_changed', { userId: user.id, newStatus: 'suspended' });
    res.json({ message: 'משתמש הושעה' });
  } catch (err) {
    console.error('Suspend user error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.post('/users/:id/activate', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const [user] = await db.update(users)
      .set({ status: 'active', updatedAt: new Date() })
      .where(and(eq(users.id, req.params.id), eq(users.orgId, orgId)))
      .returning();

    if (!user) {
      res.status(404).json({ error: 'משתמש לא נמצא' });
      return;
    }

    await logAdminActivity({
      orgId,
      adminId: req.user!.id,
      adminType: 'admin',
      action: 'user_activated',
      targetType: 'user',
      targetId: user.id,
    });

    emitToOrg(orgId, 'user:status_changed', { userId: user.id, newStatus: 'active' });
    res.json({ message: 'משתמש הופעל מחדש' });
  } catch (err) {
    console.error('Activate user error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.post('/users/bulk', validateBody(bulkCreateUsersSchema), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { users: userList } = req.body;
    const results: any[] = [];

    for (const userData of userList) {
      try {
        const [user] = await db.insert(users).values({
          orgId,
          phone: userData.phone,
          name: userData.name,
          apartment: userData.apartment,
          status: 'pending',
        }).returning();

        if (userData.doorIds?.length) {
          await db.insert(doorPermissions).values(
            userData.doorIds.map((doorId: string) => ({
              userId: user.id,
              doorId,
              grantedBy: req.user!.id,
            }))
          );
        }

        results.push({ phone: userData.phone, status: 'created', userId: user.id });
      } catch (err: any) {
        results.push({ phone: userData.phone, status: 'error', error: err.code === '23505' ? 'כבר קיים' : 'שגיאה' });
      }
    }

    await logAdminActivity({
      orgId,
      adminId: req.user!.id,
      adminType: 'admin',
      action: 'users_bulk_created',
      details: { count: results.filter((r) => r.status === 'created').length },
    });

    res.json({ results });
  } catch (err) {
    console.error('Bulk create error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/users/export', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const allUsers = await db.select().from(users).where(eq(users.orgId, orgId));

    const csv = ['שם,טלפון,דירה,סטטוס,תאריך הרשמה'];
    for (const u of allUsers) {
      csv.push(`${u.name || ''},${u.phone},${u.apartment || ''},${u.status},${u.registeredAt || ''}`);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=users.csv');
    res.send('\ufeff' + csv.join('\n'));
  } catch (err) {
    console.error('Export users error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ==================== DOORS ====================

router.get('/doors', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const orgDoors = await db.select().from(doors).where(eq(doors.orgId, orgId));

    const doorsWithStats = await Promise.all(orgDoors.map(async (door) => {
      const [userCount] = await db.select({ count: count() }).from(doorPermissions).where(eq(doorPermissions.doorId, door.id));
      const [lastAccess] = await db.select().from(accessLogs)
        .where(eq(accessLogs.doorId, door.id))
        .orderBy(desc(accessLogs.timestamp))
        .limit(1);
      return { ...door, userCount: userCount.count, lastAccess: lastAccess?.timestamp };
    }));

    res.json(doorsWithStats);
  } catch (err) {
    console.error('List doors error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/doors/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const [door] = await db.select().from(doors)
      .where(and(eq(doors.id, req.params.id), eq(doors.orgId, orgId)));

    if (!door) {
      res.status(404).json({ error: 'דלת לא נמצאה' });
      return;
    }

    const assignedUsers = await db.select({
      user: users,
      permission: doorPermissions,
    }).from(doorPermissions)
      .innerJoin(users, eq(doorPermissions.userId, users.id))
      .where(eq(doorPermissions.doorId, door.id));

    res.json({ ...door, assignedUsers: assignedUsers.map((u) => ({ ...u.user, permission: u.permission })) });
  } catch (err) {
    console.error('Get door error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.post('/doors', validateBody(createDoorSchema), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const [door] = await db.insert(doors).values({
      orgId,
      ...req.body,
      mqttTopic: `keypass/${orgId}/doors/${uuidv4()}`,
    }).returning();

    await logAdminActivity({
      orgId,
      adminId: req.user!.id,
      adminType: 'admin',
      action: 'door_created',
      targetType: 'door',
      targetId: door.id,
      details: { name: door.name },
    });

    emitToOrg(orgId, 'door:created', { doorId: door.id, name: door.name });
    res.status(201).json(door);
  } catch (err) {
    console.error('Create door error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.put('/doors/:id', validateBody(updateDoorSchema), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const [door] = await db.update(doors)
      .set(req.body)
      .where(and(eq(doors.id, req.params.id), eq(doors.orgId, orgId)))
      .returning();

    if (!door) {
      res.status(404).json({ error: 'דלת לא נמצאה' });
      return;
    }

    await logAdminActivity({
      orgId,
      adminId: req.user!.id,
      adminType: 'admin',
      action: 'door_updated',
      targetType: 'door',
      targetId: door.id,
      details: req.body,
    });

    res.json(door);
  } catch (err) {
    console.error('Update door error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.delete('/doors/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const [door] = await db.delete(doors)
      .where(and(eq(doors.id, req.params.id), eq(doors.orgId, orgId)))
      .returning();

    if (!door) {
      res.status(404).json({ error: 'דלת לא נמצאה' });
      return;
    }

    await logAdminActivity({
      orgId,
      adminId: req.user!.id,
      adminType: 'admin',
      action: 'door_deleted',
      targetType: 'door',
      targetId: door.id,
    });

    res.json({ message: 'דלת נמחקה' });
  } catch (err) {
    console.error('Delete door error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.post('/doors/:id/unlock', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const [door] = await db.select().from(doors)
      .where(and(eq(doors.id, req.params.id), eq(doors.orgId, orgId)));

    if (!door) {
      res.status(404).json({ error: 'דלת לא נמצאה' });
      return;
    }

    publishUnlock(orgId, door.id);

    await db.insert(accessLogs).values({
      orgId,
      doorId: door.id,
      action: 'remote_unlock',
      method: 'remote',
      initiatedBy: req.user!.id,
    });

    await logAdminActivity({
      orgId,
      adminId: req.user!.id,
      adminType: 'admin',
      action: 'door_remote_unlock',
      targetType: 'door',
      targetId: door.id,
    });

    emitToOrg(orgId, 'access:new_log', {
      doorId: door.id,
      doorName: door.name,
      action: 'remote_unlock',
      method: 'remote',
      initiatedBy: req.user!.id,
    });

    res.json({ message: 'פקודת פתיחה נשלחה' });
  } catch (err) {
    console.error('Remote unlock error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.post('/doors/:id/sync', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const [door] = await db.select().from(doors)
      .where(and(eq(doors.id, req.params.id), eq(doors.orgId, orgId)));

    if (!door) {
      res.status(404).json({ error: 'דלת לא נמצאה' });
      return;
    }

    // Get all active credentials for users with permission to this door
    const permUsers = await db.select({
      credentialId: credentials.id,
      publicKey: credentials.publicKey,
    }).from(doorPermissions)
      .innerJoin(users, eq(doorPermissions.userId, users.id))
      .innerJoin(credentials, eq(users.id, credentials.userId))
      .where(and(
        eq(doorPermissions.doorId, door.id),
        eq(users.status, 'active'),
        eq(credentials.isActive, true),
      ));

    publishSync(orgId, door.id, permUsers);
    res.json({ message: 'סנכרון נשלח', credentialCount: permUsers.length });
  } catch (err) {
    console.error('Sync door error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ==================== PERMISSIONS ====================

router.get('/permissions', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const perms = await db.select({
      permission: doorPermissions,
      userName: users.name,
      userPhone: users.phone,
      doorName: doors.name,
    }).from(doorPermissions)
      .innerJoin(users, eq(doorPermissions.userId, users.id))
      .innerJoin(doors, eq(doorPermissions.doorId, doors.id))
      .where(eq(users.orgId, orgId));

    res.json(perms.map((p) => ({
      ...p.permission,
      userName: p.userName,
      userPhone: p.userPhone,
      doorName: p.doorName,
    })));
  } catch (err) {
    console.error('List permissions error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.post('/permissions', validateBody(createPermissionSchema), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { userId, doorId, timeRestriction, validUntil } = req.body;

    // Verify user and door belong to this org
    const [user] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.orgId, orgId)));
    const [door] = await db.select().from(doors).where(and(eq(doors.id, doorId), eq(doors.orgId, orgId)));

    if (!user || !door) {
      res.status(404).json({ error: 'משתמש או דלת לא נמצאו' });
      return;
    }

    const [perm] = await db.insert(doorPermissions).values({
      userId,
      doorId,
      timeRestriction,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      grantedBy: req.user!.id,
    }).returning();

    await logAdminActivity({
      orgId,
      adminId: req.user!.id,
      adminType: 'admin',
      action: 'permission_granted',
      targetType: 'permission',
      targetId: perm.id,
      details: { userId, doorId },
    });

    res.status(201).json(perm);
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'הרשאה כבר קיימת' });
      return;
    }
    console.error('Create permission error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.delete('/permissions/:id', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);

    // Verify permission belongs to this org
    const [perm] = await db.select({
      permission: doorPermissions,
      userOrgId: users.orgId,
    }).from(doorPermissions)
      .innerJoin(users, eq(doorPermissions.userId, users.id))
      .where(and(eq(doorPermissions.id, req.params.id), eq(users.orgId, orgId)));

    if (!perm) {
      res.status(404).json({ error: 'הרשאה לא נמצאה' });
      return;
    }

    await db.delete(doorPermissions).where(eq(doorPermissions.id, req.params.id));

    await logAdminActivity({
      orgId,
      adminId: req.user!.id,
      adminType: 'admin',
      action: 'permission_revoked',
      targetType: 'permission',
      targetId: req.params.id,
    });

    res.json({ message: 'הרשאה בוטלה' });
  } catch (err) {
    console.error('Delete permission error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.post('/permissions/bulk', validateBody(bulkPermissionsSchema), async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const { userIds, doorIds } = req.body;
    let created = 0;

    for (const userId of userIds) {
      for (const doorId of doorIds) {
        try {
          await db.insert(doorPermissions).values({
            userId,
            doorId,
            grantedBy: req.user!.id,
          });
          created++;
        } catch {}
      }
    }

    await logAdminActivity({
      orgId,
      adminId: req.user!.id,
      adminType: 'admin',
      action: 'permissions_bulk_granted',
      details: { userCount: userIds.length, doorCount: doorIds.length, created },
    });

    res.json({ message: `${created} הרשאות נוצרו` });
  } catch (err) {
    console.error('Bulk permissions error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ==================== LOGS ====================

router.get('/logs', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const doorId = req.query.door_id as string;
    const userId = req.query.user_id as string;
    const action = req.query.action as string;
    const method = req.query.method as string;
    const from = req.query.from as string;
    const to = req.query.to as string;

    let conditions = [eq(accessLogs.orgId, orgId)];
    if (doorId) conditions.push(eq(accessLogs.doorId, doorId));
    if (userId) conditions.push(eq(accessLogs.userId, userId));
    if (action) conditions.push(eq(accessLogs.action, action));
    if (method) conditions.push(eq(accessLogs.method, method));
    if (from) conditions.push(sql`${accessLogs.timestamp} >= ${new Date(from)}`);
    if (to) conditions.push(sql`${accessLogs.timestamp} <= ${new Date(to)}`);

    const logs = await db.select({
      log: accessLogs,
      userName: users.name,
      doorName: doors.name,
    }).from(accessLogs)
      .leftJoin(users, eq(accessLogs.userId, users.id))
      .leftJoin(doors, eq(accessLogs.doorId, doors.id))
      .where(and(...conditions))
      .orderBy(desc(accessLogs.timestamp))
      .limit(limit)
      .offset(offset);

    const [total] = await db.select({ count: count() }).from(accessLogs).where(and(...conditions));

    res.json({
      data: logs.map((l) => ({ ...l.log, userName: l.userName, doorName: l.doorName })),
      total: total.count,
      page,
      limit,
    });
  } catch (err) {
    console.error('List logs error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/logs/export', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const logs = await db.select({
      log: accessLogs,
      userName: users.name,
      doorName: doors.name,
    }).from(accessLogs)
      .leftJoin(users, eq(accessLogs.userId, users.id))
      .leftJoin(doors, eq(accessLogs.doorId, doors.id))
      .where(eq(accessLogs.orgId, orgId))
      .orderBy(desc(accessLogs.timestamp));

    const csv = ['תאריך,משתמש,דלת,שיטה,סטטוס'];
    for (const l of logs) {
      csv.push(`${l.log.timestamp},${l.userName || ''},${l.doorName || ''},${l.log.method || ''},${l.log.action}`);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=access-logs.csv');
    res.send('\ufeff' + csv.join('\n'));
  } catch (err) {
    console.error('Export logs error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/logs/stats', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const period = (req.query.period as string) || 'week';

    let since: Date;
    if (period === 'day') since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    else if (period === 'month') since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    else since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalAccesses] = await db.select({ count: count() }).from(accessLogs)
      .where(and(eq(accessLogs.orgId, orgId), sql`${accessLogs.timestamp} >= ${since}`));

    const [deniedCount] = await db.select({ count: count() }).from(accessLogs)
      .where(and(eq(accessLogs.orgId, orgId), eq(accessLogs.action, 'denied'), sql`${accessLogs.timestamp} >= ${since}`));

    const byDoor = await db.select({
      doorId: accessLogs.doorId,
      doorName: doors.name,
      count: count(),
    }).from(accessLogs)
      .leftJoin(doors, eq(accessLogs.doorId, doors.id))
      .where(and(eq(accessLogs.orgId, orgId), sql`${accessLogs.timestamp} >= ${since}`))
      .groupBy(accessLogs.doorId, doors.name);

    const byMethod = await db.select({
      method: accessLogs.method,
      count: count(),
    }).from(accessLogs)
      .where(and(eq(accessLogs.orgId, orgId), sql`${accessLogs.timestamp} >= ${since}`))
      .groupBy(accessLogs.method);

    res.json({
      totalAccesses: totalAccesses.count,
      deniedCount: deniedCount.count,
      byDoor,
      byMethod,
    });
  } catch (err) {
    console.error('Logs stats error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Door real-time status
router.get('/doors/:id/status', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const [door] = await db.select().from(doors)
      .where(and(eq(doors.id, req.params.id), eq(doors.orgId, orgId)));
    if (!door) {
      res.status(404).json({ error: 'דלת לא נמצאה' });
      return;
    }
    res.json({ id: door.id, name: door.name, isOnline: door.isOnline, lastSeenAt: door.lastSeenAt });
  } catch (err) {
    console.error('Door status error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// Mock door status toggle (for development/testing)
router.post('/doors/:id/mock-toggle', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const [door] = await db.select().from(doors)
      .where(and(eq(doors.id, req.params.id), eq(doors.orgId, orgId)));
    if (!door) {
      res.status(404).json({ error: 'דלת לא נמצאה' });
      return;
    }
    const newStatus = !door.isOnline;
    await db.update(doors).set({
      isOnline: newStatus,
      lastSeenAt: newStatus ? new Date() : door.lastSeenAt,
    }).where(eq(doors.id, door.id));

    emitToOrg(orgId, 'door:status_changed', { doorId: door.id, isOnline: newStatus });
    res.json({ id: door.id, name: door.name, isOnline: newStatus });
  } catch (err) {
    console.error('Mock toggle error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ==================== SETTINGS ====================

router.get('/settings', async (req: Request, res: Response) => {
  try {
    const orgId = getOrgId(req);
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    const [admin] = await db.select().from(admins).where(eq(admins.id, req.user!.id));

    res.json({
      organization: org,
      admin: admin ? { id: admin.id, email: admin.email, name: admin.name, phone: admin.phone } : null,
    });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.put('/settings', async (req: Request, res: Response) => {
  try {
    const admin = req.body;
    if (admin.name || admin.phone) {
      await db.update(admins).set({
        ...(admin.name && { name: admin.name }),
        ...(admin.phone && { phone: admin.phone }),
      }).where(eq(admins.id, req.user!.id));
    }
    res.json({ message: 'הגדרות עודכנו' });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.put('/settings/password', validateBody(updatePasswordSchema), async (req: Request, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const [admin] = await db.select().from(admins).where(eq(admins.id, req.user!.id));

    if (!admin) {
      res.status(404).json({ error: 'מנהל לא נמצא' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!valid) {
      res.status(400).json({ error: 'סיסמה נוכחית שגויה' });
      return;
    }

    await db.update(admins).set({
      passwordHash: await bcrypt.hash(newPassword, 12),
    }).where(eq(admins.id, req.user!.id));

    res.json({ message: 'סיסמה עודכנה בהצלחה' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;

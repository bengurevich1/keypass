import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { eq, desc, sql, and, count } from 'drizzle-orm';
import { db } from '../db';
import {
  organizations, admins, users, doors, accessLogs, adminActivityLogs, superAdmins,
} from '../db/schema';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  createOrganizationSchema, updateOrganizationSchema,
  createAdminSchema, updateAdminSchema,
} from '../utils/validators';
import { logAdminActivity } from '../services/activityLog';

const router = Router();

// All routes require super_admin role
router.use(authenticate, requireRole('super_admin'));

// ==================== DASHBOARD ====================

router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const [orgCount] = await db.select({ count: count() }).from(organizations);
    const [userCount] = await db.select({ count: count() }).from(users);
    const [doorCount] = await db.select({ count: count() }).from(doors);
    const [onlineDoors] = await db.select({ count: count() }).from(doors).where(eq(doors.isOnline, true));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayAccesses] = await db.select({ count: count() }).from(accessLogs)
      .where(sql`${accessLogs.timestamp} >= ${today}`);

    // Revenue calculation
    const [revenue] = await db.select({
      total: sql<number>`COALESCE(SUM(${organizations.monthlyFee}), 0)`,
    }).from(organizations).where(eq(organizations.isActive, true));

    // Recent activity
    const recentActivity = await db.select().from(adminActivityLogs)
      .orderBy(desc(adminActivityLogs.timestamp))
      .limit(20);

    // Orgs by plan
    const orgsByPlan = await db.select({
      plan: organizations.plan,
      count: count(),
    }).from(organizations).groupBy(organizations.plan);

    res.json({
      totalOrgs: orgCount.count,
      totalUsers: userCount.count,
      totalDoors: doorCount.count,
      onlineDoors: onlineDoors.count,
      accessesToday: todayAccesses.count,
      revenueMonthly: revenue.total,
      orgsByPlan,
      recentActivity,
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ==================== ORGANIZATIONS ====================

router.get('/organizations', async (req: Request, res: Response) => {
  try {
    const orgs = await db.select().from(organizations).orderBy(desc(organizations.createdAt));

    // Get stats for each org
    const orgsWithStats = await Promise.all(orgs.map(async (org) => {
      const [userCount] = await db.select({ count: count() }).from(users).where(eq(users.orgId, org.id));
      const [doorCount] = await db.select({ count: count() }).from(doors).where(eq(doors.orgId, org.id));
      const [adminCount] = await db.select({ count: count() }).from(admins).where(eq(admins.orgId, org.id));
      return { ...org, userCount: userCount.count, doorCount: doorCount.count, adminCount: adminCount.count };
    }));

    res.json(orgsWithStats);
  } catch (err) {
    console.error('List orgs error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/organizations/:id', async (req: Request, res: Response) => {
  try {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, req.params.id));
    if (!org) {
      res.status(404).json({ error: 'ארגון לא נמצא' });
      return;
    }

    const orgAdmins = await db.select().from(admins).where(eq(admins.orgId, org.id));
    const orgDoors = await db.select().from(doors).where(eq(doors.orgId, org.id));
    const [userCount] = await db.select({ count: count() }).from(users).where(eq(users.orgId, org.id));

    res.json({ ...org, admins: orgAdmins, doors: orgDoors, userCount: userCount.count });
  } catch (err) {
    console.error('Get org error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.post('/organizations', validateBody(createOrganizationSchema), async (req: Request, res: Response) => {
  try {
    const [org] = await db.insert(organizations).values(req.body).returning();

    await logAdminActivity({
      adminId: req.user!.id,
      adminType: 'super_admin',
      action: 'organization_created',
      targetType: 'organization',
      targetId: org.id,
      details: { name: org.name },
    });

    res.status(201).json(org);
  } catch (err) {
    console.error('Create org error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.put('/organizations/:id', validateBody(updateOrganizationSchema), async (req: Request, res: Response) => {
  try {
    const [org] = await db.update(organizations)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(organizations.id, req.params.id))
      .returning();

    if (!org) {
      res.status(404).json({ error: 'ארגון לא נמצא' });
      return;
    }

    await logAdminActivity({
      adminId: req.user!.id,
      adminType: 'super_admin',
      action: 'organization_updated',
      targetType: 'organization',
      targetId: org.id,
      details: req.body,
    });

    res.json(org);
  } catch (err) {
    console.error('Update org error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.delete('/organizations/:id', async (req: Request, res: Response) => {
  try {
    const [org] = await db.update(organizations)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(organizations.id, req.params.id))
      .returning();

    if (!org) {
      res.status(404).json({ error: 'ארגון לא נמצא' });
      return;
    }

    await logAdminActivity({
      adminId: req.user!.id,
      adminType: 'super_admin',
      action: 'organization_deactivated',
      targetType: 'organization',
      targetId: org.id,
    });

    res.json({ message: 'ארגון הושבת' });
  } catch (err) {
    console.error('Delete org error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/organizations/:id/stats', async (req: Request, res: Response) => {
  try {
    const orgId = req.params.id;
    const [userCount] = await db.select({ count: count() }).from(users).where(eq(users.orgId, orgId));
    const [doorCount] = await db.select({ count: count() }).from(doors).where(eq(doors.orgId, orgId));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayAccesses] = await db.select({ count: count() }).from(accessLogs)
      .where(and(eq(accessLogs.orgId, orgId), sql`${accessLogs.timestamp} >= ${today}`));

    res.json({ userCount: userCount.count, doorCount: doorCount.count, accessesToday: todayAccesses.count });
  } catch (err) {
    console.error('Org stats error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ==================== ADMINS (per org) ====================

router.get('/organizations/:orgId/admins', async (req: Request, res: Response) => {
  try {
    const orgAdmins = await db.select().from(admins)
      .where(eq(admins.orgId, req.params.orgId))
      .orderBy(desc(admins.createdAt));
    res.json(orgAdmins);
  } catch (err) {
    console.error('List admins error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.post('/organizations/:orgId/admins', validateBody(createAdminSchema), async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone, role } = req.body;
    const orgId = req.params.orgId;

    // Check org exists
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
    if (!org) {
      res.status(404).json({ error: 'ארגון לא נמצא' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [admin] = await db.insert(admins).values({
      orgId,
      email,
      passwordHash,
      name,
      phone,
      role: role || 'admin',
    }).returning();

    await logAdminActivity({
      orgId,
      adminId: req.user!.id,
      adminType: 'super_admin',
      action: 'admin_created',
      targetType: 'admin',
      targetId: admin.id,
      details: { email, name },
    });

    res.status(201).json({ id: admin.id, email: admin.email, name: admin.name, role: admin.role });
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'אימייל כבר קיים בארגון זה' });
      return;
    }
    console.error('Create admin error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.put('/organizations/:orgId/admins/:id', validateBody(updateAdminSchema), async (req: Request, res: Response) => {
  try {
    const [admin] = await db.update(admins)
      .set(req.body)
      .where(and(eq(admins.id, req.params.id), eq(admins.orgId, req.params.orgId)))
      .returning();

    if (!admin) {
      res.status(404).json({ error: 'מנהל לא נמצא' });
      return;
    }

    await logAdminActivity({
      orgId: req.params.orgId,
      adminId: req.user!.id,
      adminType: 'super_admin',
      action: 'admin_updated',
      targetType: 'admin',
      targetId: admin.id,
      details: req.body,
    });

    res.json(admin);
  } catch (err) {
    console.error('Update admin error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.delete('/organizations/:orgId/admins/:id', async (req: Request, res: Response) => {
  try {
    const [admin] = await db.update(admins)
      .set({ isActive: false })
      .where(and(eq(admins.id, req.params.id), eq(admins.orgId, req.params.orgId)))
      .returning();

    if (!admin) {
      res.status(404).json({ error: 'מנהל לא נמצא' });
      return;
    }

    await logAdminActivity({
      orgId: req.params.orgId,
      adminId: req.user!.id,
      adminType: 'super_admin',
      action: 'admin_deactivated',
      targetType: 'admin',
      targetId: admin.id,
    });

    res.json({ message: 'מנהל הושבת' });
  } catch (err) {
    console.error('Delete admin error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

// ==================== SYSTEM ====================

router.get('/devices', async (req: Request, res: Response) => {
  try {
    const allDoors = await db.select({
      door: doors,
      orgName: organizations.name,
    }).from(doors)
      .leftJoin(organizations, eq(doors.orgId, organizations.id))
      .orderBy(desc(doors.lastSeenAt));

    res.json(allDoors.map((d) => ({
      ...d.door,
      orgName: d.orgName,
    })));
  } catch (err) {
    console.error('List devices error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

router.get('/activity-log', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const logs = await db.select().from(adminActivityLogs)
      .orderBy(desc(adminActivityLogs.timestamp))
      .limit(limit)
      .offset(offset);

    const [total] = await db.select({ count: count() }).from(adminActivityLogs);

    res.json({ data: logs, total: total.count, page, limit });
  } catch (err) {
    console.error('Activity log error:', err);
    res.status(500).json({ error: 'שגיאת שרת' });
  }
});

export default router;

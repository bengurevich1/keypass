import { db } from '../db';
import { adminActivityLogs } from '../db/schema';

interface LogEntry {
  orgId?: string;
  adminId: string;
  adminType: 'super_admin' | 'admin';
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, any>;
}

export async function logAdminActivity(entry: LogEntry): Promise<void> {
  await db.insert(adminActivityLogs).values({
    orgId: entry.orgId || undefined,
    adminId: entry.adminId,
    adminType: entry.adminType,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    details: entry.details || {},
  });
}

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { users, organizations, doors, doorPermissions, credentials } from '../db/schema';

export interface WalletUserData {
  userId: string;
  userName: string;
  orgName: string;
  status: string;
  credentialId: string;
  doorNames: string[];
}

/**
 * Loads everything needed to render a wallet pass for a single user.
 * Throws if the user does not exist.
 */
export async function loadWalletUserData(userId: string): Promise<WalletUserData> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new Error('user not found');

  let orgName = '';
  if (user.orgId) {
    const [org] = await db.select().from(organizations).where(eq(organizations.id, user.orgId));
    orgName = org?.name || '';
  }

  // Most recently issued active credential — used as the QR payload
  const [activeCredential] = await db
    .select()
    .from(credentials)
    .where(and(eq(credentials.userId, userId), eq(credentials.isActive, true)))
    .orderBy(desc(credentials.createdAt))
    .limit(1);

  const myDoors = await db
    .select({ name: doors.name })
    .from(doorPermissions)
    .innerJoin(doors, eq(doorPermissions.doorId, doors.id))
    .where(eq(doorPermissions.userId, userId));

  return {
    userId: user.id,
    userName: user.name || '',
    orgName,
    status: user.status === 'active' ? 'פעיל' : (user.status || 'pending'),
    credentialId: activeCredential?.id || user.id,
    doorNames: myDoors.map((d) => d.name),
  };
}

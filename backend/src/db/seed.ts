import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import * as schema from './schema';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://keypass:keypass123@localhost:5432/keypass';

async function seed() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, { schema });

  console.log('🌱 Seeding database...');

  // Check if super admin already exists
  const existingSuperAdmin = await db.select().from(schema.superAdmins).limit(1);
  if (existingSuperAdmin.length > 0) {
    console.log('✅ Database already seeded. Skipping.');
    await pool.end();
    return;
  }

  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@keypass.co.il';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin123456';

  // 1. Create super admin
  const superAdminId = uuidv4();
  await db.insert(schema.superAdmins).values({
    id: superAdminId,
    email: superAdminEmail,
    passwordHash: await bcrypt.hash(superAdminPassword, 12),
    name: 'מנהל על',
  });
  console.log(`  ✅ Super admin created: ${superAdminEmail}`);

  // 2. Create demo organization
  const orgId = uuidv4();
  await db.insert(schema.organizations).values({
    id: orgId,
    name: 'בניין הדגמה',
    address: 'רחוב הדגמה 1, תל אביב',
    contactName: 'מנהל הדגמה',
    contactPhone: '0501234567',
    plan: 'standard',
    monthlyFee: 1000,
    maxDoors: 5,
    maxUsers: 200,
  });
  console.log('  ✅ Demo organization created: בניין הדגמה');

  // 3. Create demo admin
  const adminId = uuidv4();
  await db.insert(schema.admins).values({
    id: adminId,
    orgId,
    email: 'demo@keypass.co.il',
    passwordHash: await bcrypt.hash('demo123456', 12),
    name: 'מנהל הדגמה',
    phone: '0501234567',
    role: 'admin',
  });
  console.log('  ✅ Demo admin created: demo@keypass.co.il');

  // 4. Create demo doors
  const door1Id = uuidv4();
  const door2Id = uuidv4();
  await db.insert(schema.doors).values([
    {
      id: door1Id,
      orgId,
      name: 'כניסה ראשית',
      description: 'דלת כניסה ראשית לבניין',
      espDeviceId: 'ESP32-DEMO-001',
      mqttTopic: `keypass/${orgId}/doors/${door1Id}`,
      isOnline: true,
      firmwareVersion: '1.0.0',
    },
    {
      id: door2Id,
      orgId,
      name: 'חניון',
      description: 'שער כניסה לחניון',
      espDeviceId: 'ESP32-DEMO-002',
      mqttTopic: `keypass/${orgId}/doors/${door2Id}`,
      isOnline: true,
      firmwareVersion: '1.0.0',
    },
  ]);
  console.log('  ✅ Demo doors created: כניסה ראשית, חניון');

  // 5. Create demo users
  const user1Id = uuidv4();
  const user2Id = uuidv4();
  const user3Id = uuidv4();
  await db.insert(schema.users).values([
    {
      id: user1Id,
      orgId,
      phone: '0521234567',
      name: 'אורן כהן',
      apartment: '12',
      status: 'active',
      registeredAt: new Date(),
    },
    {
      id: user2Id,
      orgId,
      phone: '0547654321',
      name: 'דנה לוי',
      apartment: '8',
      status: 'active',
      registeredAt: new Date(),
    },
    {
      id: user3Id,
      orgId,
      phone: '0509876543',
      name: 'יוסי אברהם',
      apartment: '3',
      status: 'pending',
    },
  ]);
  console.log('  ✅ Demo users created: אורן כהן, דנה לוי, יוסי אברהם');

  // 6. Create door permissions for active users
  await db.insert(schema.doorPermissions).values([
    { userId: user1Id, doorId: door1Id, grantedBy: adminId },
    { userId: user1Id, doorId: door2Id, grantedBy: adminId },
    { userId: user2Id, doorId: door1Id, grantedBy: adminId },
  ]);
  console.log('  ✅ Door permissions created');

  // 7. Create some demo access logs
  await db.insert(schema.accessLogs).values([
    {
      orgId,
      doorId: door1Id,
      userId: user1Id,
      action: 'unlock',
      method: 'ble',
      metadata: { latency: 120 },
    },
    {
      orgId,
      doorId: door2Id,
      userId: user1Id,
      action: 'unlock',
      method: 'ble',
      metadata: { latency: 95 },
    },
    {
      orgId,
      doorId: door1Id,
      userId: user2Id,
      action: 'unlock',
      method: 'ble',
      metadata: { latency: 150 },
    },
  ]);
  console.log('  ✅ Demo access logs created');

  console.log('\n🎉 Seed completed successfully!');
  await pool.end();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

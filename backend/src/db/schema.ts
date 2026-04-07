import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  bigserial,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ============================================
// SUPER ADMIN LEVEL
// ============================================

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  address: varchar('address', { length: 500 }),
  contactName: varchar('contact_name', { length: 255 }),
  contactPhone: varchar('contact_phone', { length: 20 }),
  plan: varchar('plan', { length: 20 }).default('standard'),
  monthlyFee: integer('monthly_fee').default(1000),
  maxDoors: integer('max_doors').default(5),
  maxUsers: integer('max_users').default(200),
  isActive: boolean('is_active').default(true),
  trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const superAdmins = pgTable('super_admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ============================================
// ADMIN LEVEL (per organization)
// ============================================

export const admins = pgTable('admins', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  role: varchar('role', { length: 20 }).default('admin'),
  isActive: boolean('is_active').default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('admins_org_email_idx').on(table.orgId, table.email),
]);

export const doors = pgTable('doors', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  espDeviceId: varchar('esp_device_id', { length: 64 }).unique(),
  mqttTopic: varchar('mqtt_topic', { length: 255 }),
  isOnline: boolean('is_online').default(false),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  firmwareVersion: varchar('firmware_version', { length: 32 }),
  unlockDurationMs: integer('unlock_duration_ms').default(3000),
  config: jsonb('config').default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_doors_org').on(table.orgId),
]);

// ============================================
// USER LEVEL (residents / employees)
// ============================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
  phone: varchar('phone', { length: 20 }).notNull(),
  name: varchar('name', { length: 255 }),
  apartment: varchar('apartment', { length: 50 }),
  email: varchar('email', { length: 255 }),
  status: varchar('status', { length: 20 }).default('pending'),
  notes: text('notes'),
  registeredAt: timestamp('registered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_users_org_status').on(table.orgId, table.status),
  uniqueIndex('idx_users_org_phone').on(table.orgId, table.phone),
]);

export const credentials = pgTable('credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  publicKey: text('public_key').notNull(),
  deviceId: varchar('device_id', { length: 255 }),
  deviceName: varchar('device_name', { length: 255 }),
  platform: varchar('platform', { length: 10 }),
  appVersion: varchar('app_version', { length: 20 }),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => [
  index('idx_credentials_user_active').on(table.userId),
]);

export const doorPermissions = pgTable('door_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  doorId: uuid('door_id').references(() => doors.id, { onDelete: 'cascade' }),
  timeRestriction: jsonb('time_restriction'),
  validFrom: timestamp('valid_from', { withTimezone: true }).defaultNow(),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  grantedBy: uuid('granted_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_door_permissions_user_door').on(table.userId, table.doorId),
  index('idx_door_permissions_user').on(table.userId),
  index('idx_door_permissions_door').on(table.doorId),
]);

export const registrationTokens = pgTable('registration_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 64 }).unique().notNull(),
  otpCode: varchar('otp_code', { length: 6 }),
  otpExpiresAt: timestamp('otp_expires_at', { withTimezone: true }),
  otpAttempts: integer('otp_attempts').default(0),
  used: boolean('used').default(false),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_reg_tokens_token').on(table.token),
]);

// ============================================
// LOGGING
// ============================================

export const accessLogs = pgTable('access_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id),
  doorId: uuid('door_id').references(() => doors.id),
  userId: uuid('user_id').references(() => users.id),
  credentialId: uuid('credential_id').references(() => credentials.id),
  action: varchar('action', { length: 20 }).notNull(),
  method: varchar('method', { length: 10 }),
  initiatedBy: uuid('initiated_by'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow(),
  metadata: jsonb('metadata'),
}, (table) => [
  index('idx_access_logs_org_ts').on(table.orgId, table.timestamp),
  index('idx_access_logs_door_ts').on(table.doorId, table.timestamp),
  index('idx_access_logs_user_ts').on(table.userId, table.timestamp),
]);

export const adminActivityLogs = pgTable('admin_activity_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id),
  adminId: uuid('admin_id'),
  adminType: varchar('admin_type', { length: 20 }),
  action: varchar('action', { length: 50 }).notNull(),
  targetType: varchar('target_type', { length: 50 }),
  targetId: uuid('target_id'),
  details: jsonb('details'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_admin_activity_org_ts').on(table.orgId, table.timestamp),
]);

export const walletPasses = pgTable('wallet_passes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  platform: varchar('platform', { length: 10 }).notNull(), // 'google' | 'apple'
  externalId: varchar('external_id', { length: 255 }),
  issuedAt: timestamp('issued_at', { withTimezone: true }).defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
}, (table) => [
  uniqueIndex('idx_wallet_passes_user_platform').on(table.userId, table.platform),
]);

export const whatsappLog = pgTable('whatsapp_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull(),
  template: varchar('template', { length: 50 }),
  status: varchar('status', { length: 20 }),
  wamid: varchar('wamid', { length: 255 }),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

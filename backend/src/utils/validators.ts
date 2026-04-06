import { z } from 'zod';

// Auth schemas
export const superAdminLoginSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  password: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים'),
});

export const adminLoginSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  password: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים'),
});

export const verifyTokenSchema = z.object({
  token: z.string().min(1, 'טוקן חסר'),
});

export const verifyOtpSchema = z.object({
  token: z.string().min(1, 'טוקן חסר'),
  otp: z.string().length(6, 'קוד אימות חייב להיות 6 ספרות'),
});

export const registerDeviceSchema = z.object({
  token: z.string().min(1, 'טוקן חסר'),
  publicKey: z.string().min(1, 'מפתח ציבורי חסר'),
  deviceId: z.string().min(1, 'מזהה מכשיר חסר'),
  deviceName: z.string().min(1, 'שם מכשיר חסר'),
  platform: z.enum(['ios', 'android']),
  appVersion: z.string().optional(),
});

export const mobileLoginSchema = z.object({
  credentialId: z.string().uuid('מזהה לא תקין'),
  signedChallenge: z.string().min(1, 'חתימה חסרה'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'טוקן רענון חסר'),
});

// Organization schemas
export const createOrganizationSchema = z.object({
  name: z.string().min(1, 'שם ארגון חסר'),
  address: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  plan: z.enum(['trial', 'standard', 'premium']).optional(),
  monthlyFee: z.number().int().min(0).optional(),
  maxDoors: z.number().int().min(1).optional(),
  maxUsers: z.number().int().min(1).optional(),
  notes: z.string().optional(),
});

export const updateOrganizationSchema = createOrganizationSchema.partial();

// Admin schemas
export const createAdminSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה'),
  password: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים'),
  name: z.string().min(1, 'שם חסר'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'viewer']).optional(),
});

export const updateAdminSchema = z.object({
  email: z.string().email('כתובת אימייל לא תקינה').optional(),
  name: z.string().min(1, 'שם חסר').optional(),
  phone: z.string().optional(),
  role: z.enum(['admin', 'viewer']).optional(),
  isActive: z.boolean().optional(),
});

// User schemas
const israeliPhoneRegex = /^05\d{8}$/;

export const createUserSchema = z.object({
  phone: z.string().regex(israeliPhoneRegex, 'מספר טלפון לא תקין (פורמט: 05XXXXXXXX)'),
  name: z.string().optional(),
  apartment: z.string().optional(),
  email: z.string().email('כתובת אימייל לא תקינה').optional(),
  doorIds: z.array(z.string().uuid()).optional(),
  sendWhatsApp: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().optional(),
  apartment: z.string().optional(),
  email: z.string().email('כתובת אימייל לא תקינה').optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const bulkCreateUsersSchema = z.object({
  users: z.array(z.object({
    phone: z.string().regex(israeliPhoneRegex, 'מספר טלפון לא תקין'),
    name: z.string().optional(),
    apartment: z.string().optional(),
    doorIds: z.array(z.string().uuid()).optional(),
  })).min(1, 'יש לספק לפחות משתמש אחד'),
});

// Door schemas
export const createDoorSchema = z.object({
  name: z.string().min(1, 'שם דלת חסר'),
  description: z.string().optional(),
  espDeviceId: z.string().optional(),
  unlockDurationMs: z.number().int().min(1000).max(10000).optional(),
});

export const updateDoorSchema = createDoorSchema.partial();

// Permission schemas
export const createPermissionSchema = z.object({
  userId: z.string().uuid('מזהה משתמש לא תקין'),
  doorId: z.string().uuid('מזהה דלת לא תקין'),
  timeRestriction: z.object({
    days: z.array(z.number().int().min(0).max(6)),
    from: z.string(),
    to: z.string(),
  }).optional(),
  validUntil: z.string().datetime().optional(),
});

export const bulkPermissionsSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1),
  doorIds: z.array(z.string().uuid()).min(1),
});

// Settings schemas
export const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'סיסמה נוכחית חסרה'),
  newPassword: z.string().min(6, 'סיסמה חדשה חייבת להכיל לפחות 6 תווים'),
});

// Mobile schemas
export const updateProfileSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
});

export const updateDeviceSchema = z.object({
  deviceName: z.string().optional(),
  appVersion: z.string().optional(),
});

// Query schemas
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const logsQuerySchema = z.object({
  doorId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  method: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

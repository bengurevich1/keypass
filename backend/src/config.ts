import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  devMode: process.env.DEV_MODE === 'true',

  database: {
    url: process.env.DATABASE_URL || 'postgresql://keypass:keypass123@localhost:5432/keypass',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'keypass-jwt-secret-dev',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'keypass-jwt-refresh-secret-dev',
    accessExpiresIn: '30d',
    refreshExpiresIn: '90d',
  },

  whatsapp: {
    token: process.env.WHATSAPP_TOKEN || '',
    phoneId: process.env.WHATSAPP_PHONE_ID || '',
    templateName: process.env.WHATSAPP_TEMPLATE_NAME || '',
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG || 'he',
    templateParamCount: parseInt(process.env.WHATSAPP_TEMPLATE_PARAMS || '3', 10),
  },

  mqtt: {
    host: process.env.MQTT_HOST || 'localhost',
    port: parseInt(process.env.MQTT_PORT || '1883', 10),
  },

  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  superAdmin: {
    email: process.env.SUPER_ADMIN_EMAIL || 'admin@keypass.co.il',
    password: process.env.SUPER_ADMIN_PASSWORD || 'admin123456',
  },

  apkPath: process.env.APK_PATH || './public/KeyPass.apk',

  cors: {
    origins: '*' as any,
  },
};

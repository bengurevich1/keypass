import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { createServer } from 'http';
import { config } from './config';
import { initSocketServer } from './services/notifications';
import { initMqtt } from './services/mqtt';

import authRoutes from './routes/auth';
import superAdminRoutes from './routes/superAdmin';
import adminRoutes from './routes/admin';
import mobileRoutes from './routes/mobile';
import registerRoutes from './routes/register';
import downloadRoutes from './routes/download';
import walletRoutes from './routes/wallet';

const app = express();
const httpServer = createServer(app);

// No security restrictions — dev/MVP
app.use(cors());
app.use(express.json());
app.use(morgan('short'));

// API Routes (registered BEFORE static catch-alls)
app.use('/api/auth', authRoutes);
app.use('/api/super', superAdminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/mobile', mobileRoutes);
app.use('/api/wallet', walletRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// HTML page routes (registration flow)
app.use('/register', registerRoutes);
app.use('/', downloadRoutes);  // handles /open, /download, /download/latest

// Landing pages (static HTML)
app.use('/css', express.static(path.join(__dirname, '../public/landing/css')));
app.use('/js', express.static(path.join(__dirname, '../public/landing/js')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '../public/landing/index.html')));
app.get('/buildings', (req, res) => res.sendFile(path.join(__dirname, '../public/landing/buildings.html')));
app.get('/offices', (req, res) => res.sendFile(path.join(__dirname, '../public/landing/offices.html')));
app.get('/gyms', (req, res) => res.sendFile(path.join(__dirname, '../public/landing/gyms.html')));

// Admin dashboard SPA
app.use('/dashboard', express.static(path.join(__dirname, '../public/dashboard')));
app.get('/dashboard/*', (req, res) => res.sendFile(path.join(__dirname, '../public/dashboard/index.html')));

// Super admin dashboard SPA
app.use('/super', express.static(path.join(__dirname, '../public/super-dashboard')));
app.get('/super/*', (req, res) => res.sendFile(path.join(__dirname, '../public/super-dashboard/index.html')));

// Favicon
app.get('/favicon.ico', (_req, res) => { res.status(204).end(); });

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'נתיב לא נמצא' });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'שגיאת שרת פנימית' });
});

// Initialize services
initSocketServer(httpServer);

try {
  initMqtt();
} catch (err) {
  console.warn('⚠️ MQTT connection failed (will retry):', err);
}

httpServer.listen(config.port, () => {
  console.log(`🚀 KeyPass server running on port ${config.port}`);
  console.log(`   Environment: ${config.nodeEnv}`);
  console.log(`   Dev mode: ${config.devMode}`);
  console.log(`   Landing: /`);
  console.log(`   Dashboard: /dashboard`);
  console.log(`   Super Admin: /super`);
  console.log(`   API: /api`);
});

export default app;

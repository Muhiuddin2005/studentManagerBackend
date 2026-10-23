import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import taskRoutes from './routes/taskRoutes.js';
import authRoutes from './routes/authRoutes.js';
import routineRoutes from './routes/routineRoutes.js';
import tupleRoutes from './routes/tupleRoutes.js';
import { supabase, isSupabaseConfigured } from './config/supabase.js';
import { ensureBucketPublic } from './services/storageService.js';
import { initRoutineScheduler } from './services/routineScheduler.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend and cross-origin requests
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'X-User-Role',
    'x-user-role',
    'X-User-Email',
    'x-user-email',
    'X-Actor-Role',
    'x-actor-role'
  ]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve local uploaded files statically
const uploadsDir = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// Root status endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Home Tutor Task & Routine API',
    status: 'online',
    health: '/api/health',
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/api/health', async (_req: Request, res: Response) => {
  let databaseTablesReady = false;
  if (isSupabaseConfigured && supabase) {
    try {
      const { error } = await supabase.from('tasks').select('id').limit(1);
      databaseTablesReady = !error;
    } catch {
      databaseTablesReady = false;
    }
  }

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabaseConnected: isSupabaseConfigured,
    databaseTablesReady,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Authentication API (Registration with Nodemailer email code, Login without hashing in Supabase)
app.use('/api/auth', authRoutes);

// Task & Timeline API
app.use('/api/tasks', taskRoutes);

// 7-Day Weekly Routine API (Student can create, only tutor can delete)
app.use('/api/routines', routineRoutes);

// Teacher-Student Tuple & Pairing API
app.use('/api/tuples', tupleRoutes);

// Admin / Production Database Reset Endpoint
app.post('/api/admin/clear-database', async (_req: Request, res: Response) => {
  try {
    const { clearAllDatabaseTables } = await import('./scripts/clearAllTables.js');
    const result = await clearAllDatabaseTables();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: err.message || 'Internal server error' });
});

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🚀 Home Tutor TypeScript API running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🗄️  Supabase status: ${isSupabaseConfigured ? 'LIVE CONNECTED' : 'LOCAL FALLBACK READY'}`);
    console.log(`===============================================`);
    
    // Initialize daily 6:00 AM student routine briefing cron
    initRoutineScheduler();
  });
}

export default app;

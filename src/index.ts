import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection } from './config/supabase.js';
import authRoutes from './routes/auth.js';
import orderRoutes from './routes/orders.js';
import historyRoutes from './routes/history.js';
import uploadRoutes from './routes/upload.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins (in production, specify your Electron app origin)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/upload', uploadRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'DC Cakes Server is running',
    timestamp: new Date().toISOString()
  });
});

// Test Supabase connection
app.get('/api/test-supabase', async (req, res) => {
  try {
    const connectionTest = await testConnection();
    
    if (!connectionTest.success) {
      return res.status(500).json({ 
        success: false,
        error: connectionTest.message,
        details: connectionTest.error,
        supabaseUrl: process.env.SUPABASE_URL ? 'Configured' : 'Not configured'
      });
    }
    
    res.json({ 
      success: true, 
      message: connectionTest.message,
      supabaseUrl: process.env.SUPABASE_URL?.substring(0, 30) + '...',
      hasAdminKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: 'Supabase connection error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get Supabase connection status
app.get('/api/supabase/status', async (req, res) => {
  const hasUrl = !!process.env.SUPABASE_URL;
  const hasAnonKey = !!process.env.SUPABASE_ANON_KEY;
  const hasServiceKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const connectionTest = await testConnection();
  
  res.json({
    configured: hasUrl && hasAnonKey,
    connection: connectionTest.success,
    message: connectionTest.message,
    environment: {
      hasUrl,
      hasAnonKey,
      hasServiceKey,
      url: hasUrl ? process.env.SUPABASE_URL?.substring(0, 30) + '...' : 'Not set'
    }
  });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🚀 DC Cakes Server running on http://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  
  // Test Supabase connection on startup
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    console.log('\n🔌 Testing Supabase connection...');
    const connectionTest = await testConnection();
    if (connectionTest.success) {
      console.log('✅ Supabase connected successfully!');
    } else {
      console.warn('⚠️  Supabase connection failed:', connectionTest.error);
    }
  } else {
    console.warn('⚠️  Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
  }
  
  console.log(`\n📡 API Endpoints:`);
  console.log(`   GET  /health - Health check`);
  console.log(`   GET  /api/test-supabase - Test Supabase connection`);
  console.log(`   GET  /api/supabase/status - Get Supabase status`);
  console.log(`\n🔐 Authentication:`);
  console.log(`   POST /api/auth/register - Register new viewer (public)`);
  console.log(`   POST /api/auth/register-admin - Register new admin (public)`);
  console.log(`   POST /api/auth/login - Login user`);
  console.log(`   GET  /api/auth/me - Get current user (auth required)`);
  console.log(`   PUT  /api/auth/profile - Update profile (auth required)`);
  console.log(`   POST /api/auth/logout - Logout (auth required)`);
  console.log(`   POST /api/auth/create-viewer - Create viewer account (public)`);
  console.log(`\n📦 Orders:`);
  console.log(`   GET    /api/orders - Get all orders (auth required)`);
  console.log(`   GET    /api/orders/:id - Get order by ID (auth required)`);
  console.log(`   POST   /api/orders - Create order (admin required)`);
  console.log(`   PUT    /api/orders/:id - Update order (admin required)`);
  console.log(`   DELETE /api/orders/:id - Delete order (admin required)`);
  console.log(`   GET    /api/orders/stats/summary - Get order stats (auth required)`);
  console.log(`\n📤 Upload:`);
  console.log(`   POST   /api/upload/image - Upload image (admin required)`);
  console.log(`\n📝 Order History:`);
  console.log(`   GET    /api/history - Get order history (auth required)`);
  console.log(`   POST   /api/history - Create history record (admin required)\n`);
});


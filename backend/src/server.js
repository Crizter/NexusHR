import 'dotenv/config';
import express   from 'express';
import cors      from 'cors';
import connectDB from './config/db.js';

// ─── Route imports ────────────────────────────────────────────────────────────
import authRoutes from './routes/authRoutes.js';

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
// app.use(cors({
// //   origin:      process.env.CLIENT_URL || 'http://localhost:5173',
//   origin: '*',
//   credentials: true,
// }));

app.use(cors({
  origin:      '*',           // ← open for development/Postman testing
  credentials: false,         // ← must be false when origin is '*'
  methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
    console.log('res',res) ; 
  res.json({
    status:   'ok',
    database: 'connected',
    env:   process.env.NODE_ENV,
  });
    
});

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
};

start();
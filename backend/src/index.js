import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/api.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors({
  origin: '*', // Allow Vercel frontend and local development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-secret']
}));

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API Routes
app.use('/api', apiRouter);

// Root route
app.get('/', (req, res) => {
  res.json({
    name: 'INE Product Price Tracker API',
    status: 'running',
    docs: {
      health: '/api/health',
      catalogSearch: '/api/catalog/search?q=...',
      products: '/api/products',
      cronTrigger: '/api/scrape/cron'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`===========================================`);
  console.log(` INE Price Tracker Backend Server Started `);
  console.log(` Port: ${PORT}                           `);
  console.log(` Health: http://localhost:${PORT}/api/health `);
  console.log(`===========================================`);
});


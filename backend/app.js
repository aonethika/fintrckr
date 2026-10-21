import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/authRoutes.js';
import workspaceRoutes from './routes/workspaceRoutes.js';
import aiRoutes from './routes/aiRoutes.js';

const frontendDirectory = fileURLToPath(new URL('../frontend/dist/', import.meta.url));
export function createApp({ staticDirectory = frontendDirectory } = {}) {
  const app = express();
  app.disable('x-powered-by');
  const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', process.env.FRONTEND_URL, process.env.RENDER_EXTERNAL_URL].filter(Boolean);
  app.use(cors({ origin(origin, done) {
    if (!origin || allowedOrigins.includes(origin)) return done(null, true);
    done(Object.assign(new Error('This origin is not allowed.'), { status: 403 }));
  } }));
  app.use(express.json({ limit: '4mb' }));
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/health', (req, res) => {
    const ready = mongoose.connection.readyState === 1;
    res.status(ready ? 200 : 503).json({ service: 'Finsight', status: ready ? 'ready' : 'database unavailable' });
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/workspace', workspaceRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found.' }));
  // Keep older local receipt links readable. New receipts are stored with their transaction.
  app.use('/uploads', express.static(fileURLToPath(new URL('./uploads/', import.meta.url)), { dotfiles: 'deny' }));
  if (existsSync(path.join(staticDirectory, 'index.html'))) {
    app.use(express.static(staticDirectory, { dotfiles: 'deny', index: false }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || path.extname(req.path) || !req.accepts('html')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(staticDirectory, 'index.html'));
    });
  }
  app.use((req, res) => res.status(404).json({ message: 'Page not found.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || 500;
    res.status(status).json({ message: status < 500 ? error.message : 'The request could not be completed.' });
  });
  return app;
}

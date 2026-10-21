import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';

dotenv.config({ quiet: true });
const port = Number(process.env.PORT || 5050);
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');

try {
  if (!process.env.JWT_SECRET) throw new Error('Set JWT_SECRET in the backend environment.');
  await connectDB();
  const app = createApp();
  app.listen(port, host, () => console.log(`Finsight listening on http://${host}:${port}`));
} catch (error) {
  console.error('Finsight could not start:', error.message);
  process.exitCode = 1;
}

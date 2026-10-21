import { aiError } from './aiClient.js';

const inFlight = new Set(), windows = new Map();
export async function runAI(userId, task) {
  const key = String(userId), now = Date.now();
  if (inFlight.has(key)) throw aiError('Your AI is still working on the previous request. Please wait.', 429);
  const recent = (windows.get(key) || []).filter(t => now - t < 60000);
  if (recent.length >= 6) throw aiError('Please wait a minute before requesting more AI analysis.', 429);
  if (windows.size > 5000) for (const [id, timestamps] of windows) if (!timestamps.some(t => now - t < 60000)) windows.delete(id);
  windows.set(key, [...recent, now]); inFlight.add(key);
  try { return await task(); } finally { inFlight.delete(key); }
}

import express from 'express';
import { authMiddleware } from '../middleware/verifyToken.js';
import { aiConfig } from '../config/ai.js';
import { aiError } from '../services/aiClient.js';
import { financialContext, monthRange, analyzeFinances, askFinances } from '../services/financialAI.js';
import AIAnalysis from '../models/AIAnalysis.js';
import AIConversation from '../models/AIConversation.js';
import { runAI } from '../services/aiLimit.js';

const router = express.Router();
router.use(authMiddleware);
const route = handler => async (req, res, next) => { try { await handler(req, res); } catch (error) { next(error); } };

router.get('/status', (req, res) => {
  const { configured, provider, model } = aiConfig();
  res.json({ configured, provider, model, statementExtraction: configured, categorization: configured });
});
router.get('/analysis', route(async (req, res) => {
  const context = await financialContext(req.user, req.query.month);
  const saved = await AIAnalysis.findOne({ user: req.user._id, month: req.query.month }).lean();
  res.json({ analysis: saved ? { report: saved.report, model: saved.model, provider: saved.provider, generatedAt: saved.updatedAt, stale: saved.fingerprint !== context.fingerprint } : null, facts: context.facts, hasData: context.hasData });
}));
router.post('/analysis', route(async (req, res) => {
  const output = await runAI(req.user._id, async () => {
    const context = await financialContext(req.user, req.body.month);
    if (!context.hasData) throw aiError('Import a statement or add transactions for this month before generating an analysis.', 400);
    const result = await analyzeFinances(context.facts);
    const saved = await AIAnalysis.findOneAndUpdate({ user: req.user._id, month: req.body.month }, { ...result, fingerprint: context.fingerprint }, { upsert: true, returnDocument: 'after', runValidators: true });
    return { analysis: { ...result, generatedAt: saved.updatedAt, stale: false }, facts: context.facts, hasData: true };
  });
  res.json(output);
}));
router.get('/chat', route(async (req, res) => {
  monthRange(req.query.month);
  const chat = await AIConversation.findOne({ user: req.user._id, month: req.query.month }).lean();
  res.json({ messages: chat?.messages || [] });
}));
router.post('/chat', route(async (req, res) => {
  const { month, question } = req.body;
  if (typeof question !== 'string' || !question.trim() || question.length > 1500) throw aiError('Ask a question of between 1 and 1,500 characters.', 400);
  const output = await runAI(req.user._id, async () => {
    const context = await financialContext(req.user, month);
    if (!context.hasData) throw aiError('Add transactions or import a statement first so the AI can answer from your records.', 400);
    const chat = await AIConversation.findOne({ user: req.user._id, month }).lean();
    const result = await askFinances(context.facts, question.trim(), chat?.messages || []);
    const additions = [{ role: 'user', content: question.trim(), createdAt: new Date() }, { role: 'assistant', content: result.content, createdAt: new Date() }];
    const saved = await AIConversation.findOneAndUpdate({ user: req.user._id, month }, { $push: { messages: { $each: additions, $slice: -60 } } }, { upsert: true, returnDocument: 'after', runValidators: true });
    return { messages: saved.messages, model: result.model, provider: result.provider };
  });
  res.json(output);
}));
router.delete('/chat', route(async (req, res) => {
  monthRange(req.query.month);
  await AIConversation.deleteOne({ user: req.user._id, month: req.query.month });
  res.json({ messages: [] });
}));
router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  res.status(error.status || 500).json({ message: error.status ? error.message : 'AI analysis could not be completed. Please try again.' });
});
export default router;

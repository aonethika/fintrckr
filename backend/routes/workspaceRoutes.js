import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { createHash } from 'node:crypto';
import { authMiddleware } from '../middleware/verifyToken.js';
import Account from '../models/Account.js';
import Statement from '../models/Statement.js';
import Transaction from '../models/Transaction.js';
import Group from '../models/Group.js';
import User from '../models/User.js';
import { parseStatement, validateRows } from '../services/statementParser.js';
import receiptUpload, { receiptImage } from '../middleware/receiptUpload.js';
import { runAI } from '../services/aiLimit.js';

const router = express.Router();
router.use(authMiddleware);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const route = handler => async (req, res, next) => { try { await handler(req, res); } catch (e) { next(e); } };
function check(condition, message, status = 400) { if (!condition) throw Object.assign(new Error(message), { status }); }
const id = value => String(value?._id || value);
const cents = amount => Math.round(Number(amount) * 100);

router.get('/', route(async (req, res) => {
  const user = req.user._id;
  const [accounts, transactions, statements, groups] = await Promise.all([
    Account.find({ user }).sort({ createdAt: 1 }).lean(),
    Transaction.find({ user, isGroupTransaction: false }).sort({ date: -1 }).lean(),
    Statement.find({ user }).sort({ createdAt: -1 }).lean(),
    Group.find({ members: user }).populate('members', 'name email upiId').populate('messages.sender', 'name').sort({ updatedAt: -1 }).lean(),
  ]);
  const splits = await Transaction.find({ group: { $in: groups.map(g => g._id) }, isGroupTransaction: true }).lean();
  res.json({ user: { id: user, name: req.user.name, email: req.user.email, upiId: req.user.upiId || '' }, accounts, transactions, statements, groups: groups.map(g => ({ ...g, expenses: splits.filter(t => id(t.group) === id(g._id)) })), budgets: Object.fromEntries(req.user.monthlyBudgets || []), categoryBudgets: Object.fromEntries([...(req.user.categoryBudgets || [])].map(([k, v]) => [k, Object.fromEntries(v)])), categories: req.user.categories });
}));

router.post('/accounts', route(async (req, res) => {
  const { name, institution, type, openingBalance, lastFour } = req.body;
  check(typeof name === 'string' && name.trim(), 'Account name is required.');
  check(Number.isFinite(Number(openingBalance)), 'Opening balance must be a number.');
  check(!lastFour || /^\d{4}$/.test(lastFour), 'Use the last four digits only.');
  res.status(201).json(await Account.create({ user: req.user._id, name, institution, type, openingBalance: Number(openingBalance), lastFour }));
}));

router.post('/transactions', receiptUpload.single('image'), route(async (req, res) => {
  const [row] = validateRows([req.body]);
  const account = req.body.account || null;
  if (account) check(await Account.exists({ _id: account, user: req.user._id }), 'Account not found.', 404);
  res.status(201).json(await Transaction.create({ ...row, account, user: req.user._id, payer: req.user._id, image: receiptImage(req.file) }));
}));
router.put('/transactions/:id', receiptUpload.single('image'), route(async (req, res) => {
  const [row] = validateRows([req.body]);
  const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id, isGroupTransaction: false });
  check(transaction, 'Transaction not found.', 404);
  check(!transaction.sourceSplit, 'Shared expenses are managed in their group.');
  const account = req.body.account || null;
  if (account) check(await Account.exists({ _id: account, user: req.user._id }), 'Account not found.', 404);
  Object.assign(transaction, row, { account });
  if (row.categorySource !== 'ai') transaction.aiConfidence = null;
  if (req.file) transaction.image = receiptImage(req.file);
  await transaction.save(); res.json(transaction);
}));
router.delete('/transactions/:id', route(async (req, res) => {
  const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id, isGroupTransaction: false });
  check(transaction, 'Transaction not found.', 404);
  check(!transaction.sourceSplit, 'Shared expenses are managed in their group.');
  await transaction.deleteOne(); res.json({ success: true });
}));

router.put('/budget', route(async (req, res) => {
  const { month, amount, category } = req.body;
  check(/^\d{4}-(0[1-9]|1[0-2])$/.test(month), 'Use a valid YYYY-MM month.');
  check(Number.isFinite(Number(amount)) && Number(amount) > 0, 'Budget must be positive.');
  const user = await User.findById(req.user._id);
  if (category) {
    check(typeof category === 'string' && category.trim() && category.length < 80, 'Invalid category.');
    const budgets = user.categoryBudgets.get(month) || new Map();
    budgets.set(category, Number(amount)); user.categoryBudgets.set(month, budgets);
  } else user.monthlyBudgets.set(month, Number(amount));
  await user.save(); res.json({ success: true });
}));
router.put('/profile', route(async (req, res) => {
  const { name, upiId } = req.body;
  check(typeof name === 'string' && name.trim(), 'Name is required.');
  check(!upiId || /^[\w.\-]+@[\w]+$/.test(upiId), 'Enter a valid UPI ID.');
  await User.updateOne({ _id: req.user._id }, { name: name.trim(), upiId }); res.json({ success: true });
}));

router.post('/statements/preview', upload.single('file'), route(async (req, res) => {
  check(req.file && /\.(csv|pdf)$/i.test(req.file.originalname), 'Choose a CSV or PDF statement.');
  const useAI = req.body.useAI === 'true';
  const preview = async () => {
    try { return await parseStatement(req.file.buffer, req.file.originalname, { useAI, aiOptions: { signal: AbortSignal.timeout(240000) } }); }
    catch (error) { if (!error.status) error.status = 400; throw error; }
  };
  const result = useAI ? await runAI(req.user._id, preview) : await preview();
  res.json({ ...result, name: req.file.originalname });
}));
router.post('/statements/import', route(async (req, res) => {
  const user = req.user._id;
  const { account, name, fileType } = req.body;
  check(await Account.exists({ _id: account, user }), 'Choose one of your accounts.');
  check(typeof name === 'string' && name.length <= 255 && ['CSV', 'PDF'].includes(fileType), 'Invalid statement details.');
  const rows = validateRows(req.body.rows);
  // Canonical content hash prevents the same reviewed statement being imported twice.
  const fingerprint = createHash('sha256').update(JSON.stringify({ account, rows: rows.map(({ title, date, amount, transactionType }) => ({ title, date, amount, transactionType })) })).digest('hex');
  check(!await Statement.exists({ user, fingerprint }), 'This statement has already been imported.', 409);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const [statement] = await Statement.create([{ user, account, name, fileType, fingerprint, count: rows.length }], { session });
      await Transaction.insertMany(rows.map(row => ({ ...row, user, payer: user, account, statement: statement._id })), { session });
    });
  } finally { await session.endSession(); }
  res.status(201).json({ count: rows.length });
}));

router.post('/groups', route(async (req, res) => {
  const { name, emails } = req.body;
  check(typeof name === 'string' && name.trim() && Array.isArray(emails), 'Group name and members are required.');
  const normalized = [...new Set(emails.map(e => String(e).trim().toLowerCase()).filter(e => e && e !== req.user.email))];
  const users = await User.find({ email: { $in: normalized } });
  check(users.length === normalized.length, 'Each member must have a Finsight account.');
  res.status(201).json(await Group.create({ name: name.trim(), admin: req.user._id, members: [req.user._id, ...users.map(u => u._id)], messages: [{ type: 'system', text: `${req.user.name} created this group.` }] }));
}));
router.post('/groups/:id/messages', route(async (req, res) => {
  check(typeof req.body.text === 'string' && req.body.text.trim() && req.body.text.length <= 2000, 'Write a message of up to 2,000 characters.');
  const group = await Group.findOneAndUpdate({ _id: req.params.id, members: req.user._id }, { $push: { messages: { type: 'text', text: req.body.text.trim(), sender: req.user._id } } }, { returnDocument: 'after' });
  check(group, 'Group not found.', 404); res.json({ success: true });
}));
router.post('/groups/:id/splits', route(async (req, res) => {
  const group = await Group.findOne({ _id: req.params.id, members: req.user._id });
  check(group, 'Group not found.', 404);
  const { title, amount, payer, splits } = req.body;
  check(typeof title === 'string' && title.trim() && Number.isFinite(Number(amount)) && Number(amount) > 0, 'Title and positive amount are required.');
  const members = group.members.map(id);
  check(members.includes(id(payer)), 'Payer must belong to this group.');
  check(Array.isArray(splits) && splits.length > 0 && new Set(splits.map(s => id(s.user))).size === splits.length, 'Choose unique split members.');
  check(splits.every(s => members.includes(id(s.user)) && Number.isFinite(Number(s.amount)) && Number(s.amount) >= 0), 'Invalid split members or amounts.');
  check(splits.reduce((sum, s) => sum + cents(s.amount), 0) === cents(amount), 'Shares must add up to the total.');
  const session = await mongoose.startSession();
  try { await session.withTransaction(async () => {
    const [expense] = await Transaction.create([{ user: req.user._id, creator: req.user._id, payer, group: group._id, title: title.trim(), amount: cents(amount) / 100, category: 'Group Split', isGroupTransaction: true, splits: splits.map(s => ({ user: s.user, amount: cents(s.amount) / 100, status: id(s.user) === id(payer) ? 'paid' : 'unpaid' })) }], { session });
    // Each member's own share is an expense once. Reimbursements never reduce the payer's share.
    await Transaction.insertMany(splits.filter(s => Number(s.amount) > 0).map(s => ({ user: s.user, payer, group: group._id, title: `${title.trim()} · your share`, amount: cents(s.amount) / 100, category: 'Group Split', sourceSplit: expense._id })), { session });
    await Group.updateOne({ _id: group._id }, { $push: { messages: { type: 'split', title, amount, expense: expense._id, sender: req.user._id } }, status: 'active' }, { session });
  }); } finally { await session.endSession(); }
  res.status(201).json({ success: true });
}));
router.put('/splits/:id', route(async (req, res) => {
  const expense = await Transaction.findOne({ _id: req.params.id, isGroupTransaction: true });
  check(expense && await Group.exists({ _id: expense.group, members: req.user._id }), 'Expense not found.', 404);
  const ownId = id(req.user._id);
  const member = req.body.member || ownId;
  const split = expense.splits.find(s => id(s.user) === id(member));
  check(split && id(member) !== id(expense.payer), 'Invalid settlement.');
  const confirming = id(expense.payer) === ownId;
  check(confirming ? split.status === 'requested' : id(member) === ownId && split.status === 'unpaid', 'This payment cannot be updated.');
  const next = confirming ? 'paid' : 'requested';
  const updated = await Transaction.updateOne({ _id: expense._id, splits: { $elemMatch: { user: member, status: split.status } } }, { $set: { 'splits.$.status': next } });
  check(updated.modifiedCount === 1, 'Payment was already updated. Refresh and try again.', 409);
  await Group.updateOne({ _id: expense.group }, { $push: { messages: { type: 'system', text: `${req.user.name} ${confirming ? 'confirmed a payment' : 'marked their share as paid'} for ${expense.title}.` } } });
  res.json({ success: true });
}));

router.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || (err.code === 11000 ? 409 : ['ValidationError', 'CastError', 'MulterError'].includes(err.name) ? 400 : 500);
  res.status(status).json({ message: status === 500 ? 'The operation could not be completed. Check your database connection and try again.' : err.message });
});
export default router;

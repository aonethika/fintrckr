import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';
import { categorizeWithAI, extractStatementWithAI } from './financialAI.js';

export function categorize(description, type = 'expense') {
  if (type === 'income') return /salary|payroll/i.test(description) ? 'Salary' : 'Other income';
  const rules = [
    ['Food & drinks', /swiggy|zomato|restaurant|cafe|coffee|food|dining/i],
    ['Groceries', /grocery|groceries|bigbasket|blinkit|supermarket|dmart/i],
    ['Transport', /uber|ola|metro|petrol|fuel|taxi|rapido/i],
    ['Shopping', /amazon|flipkart|myntra|shopping/i],
    ['Subscriptions', /netflix|spotify|subscription|youtube|apple music/i],
    ['Housing', /rent|electricity|water bill|internet|broadband/i],
    ['Health', /hospital|pharmacy|doctor|medical/i],
    ['Travel', /hotel|flight|airline|irctc|airbnb/i],
  ];
  return rules.find(([, re]) => re.test(description))?.[0] || 'Other';
}

export function validateRows(rows) {
  if (!Array.isArray(rows) || !rows.length || rows.length > 3000) throw new Error('A statement must contain between 1 and 3,000 transactions.');
  return rows.map((row, i) => {
    const title = String(row.title || row.description || '').trim();
    const dateString = String(row.date || '').trim();
    const date = new Date(dateString);
    const amount = Number(String(row.amount).replace(/[,₹\s]/g, ''));
    const transactionType = String(row.transactionType || row.type || '').toLowerCase();
    if (!title || title.length > 500 || !/^\d{4}-\d{2}-\d{2}/.test(dateString) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateString.slice(0, 10) || !Number.isFinite(amount) || amount <= 0 || !['income', 'expense'].includes(transactionType)) {
      throw new Error(`Row ${i + 2}: use a valid YYYY-MM-DD date, description, positive amount, and INCOME or EXPENSE type.`);
    }
    return { title, date, amount: Math.round(amount * 100) / 100, transactionType, category: String(row.category || categorize(title, transactionType)).trim(), categorySource: ['manual', 'rules', 'ai'].includes(row.categorySource) ? row.categorySource : row.category ? 'manual' : 'rules', ...(typeof row.aiConfidence === 'number' && row.aiConfidence >= 0 && row.aiConfidence <= 1 ? { aiConfidence: row.aiConfidence } : {}) };
  });
}

export async function parseStatement(buffer, name, { useAI = false, aiOptions } = {}) {
  const fileType = name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'CSV';
  let rows;
  if (fileType === 'CSV') {
    rows = parse(buffer.toString('utf8'), { columns: headers => headers.map(h => h.replace(/^\uFEFF/, '').trim().toLowerCase()), skip_empty_lines: true, trim: true, bom: true });
  } else {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    let text;
    try { text = (await parser.getText()).text; } finally { await parser.destroy(); }
    // AI handles unfamiliar text layouts; the standard parser remains an explicit alternative.
    rows = useAI ? await extractStatementWithAI(text, aiOptions) : text.split('\n').flatMap(line => {
      const match = line.trim().match(/^(\d{4}-\d{2}-\d{2})\s+(.+?)\s+([\d,]+\.\d{2})\s+(INCOME|EXPENSE|CR|DR)$/i);
      return match ? [{ date: match[1], description: match[2], amount: match[3], type: /INCOME|CR/i.test(match[4]) ? 'income' : 'expense' }] : [];
    });
    if (!rows.length) throw new Error('This PDF layout needs AI extraction. Enable AI, or export your bank statement as CSV.');
  }
  let validated = validateRows(rows);
  if (useAI && fileType === 'CSV') validated = await categorizeWithAI(validated, aiOptions);
  return { rows: validated, fileType, fingerprint: createHash('sha256').update(buffer).digest('hex'), analysisMethod: useAI ? 'ai' : 'standard' };
}

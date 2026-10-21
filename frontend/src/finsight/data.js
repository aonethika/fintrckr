export const categories = ['Food & drinks', 'Groceries', 'Transport', 'Shopping', 'Subscriptions', 'Housing', 'Health', 'Travel', 'Education', 'Entertainment', 'Investment', 'Transfer', 'Group Split', 'Salary', 'Other income', 'Other'];
export const money = (value, compact = false) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: compact ? 1 : 0, notation: compact ? 'compact' : 'standard' }).format(value || 0);
export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const monthKey = () => localDate().slice(0, 7);
export const getId = value => typeof value === 'object' ? value?._id || value?.id : value;

export function groupBalance(group, userId) {
  return group.expenses.reduce((out, expense) => {
    expense.splits.forEach(s => {
      if (s.status === 'paid') return;
      if (getId(expense.payer) === userId && getId(s.user) !== userId) out.receive += s.amount;
      if (getId(s.user) === userId && getId(expense.payer) !== userId) out.owe += s.amount;
    });
    return out;
  }, { receive: 0, owe: 0 });
}
export function summarize(data, month) {
  const transactions = data.transactions.filter(t => t.date.slice(0, 7) === month);
  const income = transactions.filter(t => t.transactionType === 'income' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0);
  const spent = transactions.filter(t => t.transactionType === 'expense' && t.category !== 'Transfer').reduce((s, t) => s + t.amount, 0);
  const breakdown = Object.entries(transactions.filter(t => t.transactionType === 'expense' && t.category !== 'Transfer').reduce((out, t) => ({ ...out, [t.category]: (out[t.category] || 0) + t.amount }), {})).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const balance = data.accounts.reduce((s, a) => s + accountBalance(a, data.transactions), 0);
  const shared = data.groups.reduce((s, g) => { const b = groupBalance(g, data.user.id); return { receive: s.receive + b.receive, owe: s.owe + b.owe }; }, { receive: 0, owe: 0 });
  return { transactions, income, spent, breakdown, balance, shared, budget: data.budgets[month] || 0 };
}
export const accountBalance = (account, transactions) => transactions.filter(t => getId(t.account) === account._id).reduce((s, t) => s + (t.transactionType === 'income' ? t.amount : -t.amount), account.openingBalance);

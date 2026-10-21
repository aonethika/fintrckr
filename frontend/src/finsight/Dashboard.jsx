import { useState } from 'react';
import Icon from './Icon';
import { Panel, BudgetBar, TransactionTable, Empty, GroupMembers } from './UI';
import { money, summarize, groupBalance } from './data';

const colors = ['#b5d7a0', '#b5add4', '#d8b795', '#87b5bb', '#b38d9c', '#8ba18c'];
function CashFlowChart({ data, month, range }) {
  const year = Number(month.slice(0, 4)), monthIndex = Number(month.slice(5)) - 1;
  const count = range === 'month' ? 6 : 6;
  const points = Array.from({ length: count }, (_, i) => {
    let rows, label;
    if (range === 'month') {
      const start = i * 5 + 1, end = i === 5 ? 32 : start + 5;
      rows = data.transactions.filter(t => t.date.slice(0, 7) === month && Number(t.date.slice(8, 10)) >= start && Number(t.date.slice(8, 10)) < end);
      label = `${String(start).padStart(2, '0')} ${new Date(year, monthIndex).toLocaleDateString('en-IN', { month: 'short' })}`;
    } else {
      const date = new Date(year, monthIndex - 5 + i, 1);
      rows = data.transactions.filter(t => t.date.slice(0, 7) === `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
      label = date.toLocaleDateString('en-IN', { month: 'short' });
    }
    rows = rows.filter(t => t.category !== 'Transfer');
    return { label, income: rows.filter(t => t.transactionType === 'income').reduce((s, t) => s + t.amount, 0), expense: rows.filter(t => t.transactionType === 'expense').reduce((s, t) => s + t.amount, 0) };
  });
  const max = Math.max(1000, ...points.flatMap(p => [p.income, p.expense]));
  const step = Math.ceil(max / 4 / 1000) * 1000;
  const scale = step * 4;
  const x = i => 55 + i * 116;
  const y = value => 195 - value / scale * 163;
  const line = key => points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p[key])}`).join(' ');
  return <div className="cash-chart"><svg viewBox="0 0 665 237" role="img" aria-label={`${range === 'month' ? 'Five-day' : 'Monthly'} income and expense totals. Green represents income and lavender represents spending.`}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b5d7a0" stopOpacity=".1"/><stop offset="100%" stopColor="#b5d7a0" stopOpacity="0"/></linearGradient><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b5add4" stopOpacity=".12"/><stop offset="100%" stopColor="#b5add4" stopOpacity="0"/></linearGradient></defs>{Array.from({ length: 5 }, (_, i) => <g key={i}><line x1="55" x2="641" y1={y(i * step)} y2={y(i * step)} stroke="#2a2d2a" strokeDasharray="3 5"/><text x="0" y={y(i * step) + 4}>{i ? money(i * step, true) : '₹0'}</text></g>)}<path d={`${line('income')} L635,195 L55,195 Z`} fill="url(#incomeFill)"/><path d={`${line('expense')} L635,195 L55,195 Z`} fill="url(#expenseFill)"/><path d={line('income')} fill="none" stroke="#b5d7a0" strokeWidth="2.4" strokeLinejoin="round"/><path d={line('expense')} fill="none" stroke="#b5add4" strokeWidth="2.4" strokeLinejoin="round"/>{points.map((p, i) => <g key={p.label}><circle cx={x(i)} cy={y(p.income)} r="3" fill="#b5d7a0"><title>{p.label}: income {money(p.income)}</title></circle><circle cx={x(i)} cy={y(p.expense)} r="3" fill="#b5add4"><title>{p.label}: spending {money(p.expense)}</title></circle><text x={x(i)} y="227" textAnchor={i === 0 ? 'start' : 'middle'}>{p.label}</text></g>)}</svg></div>;
}

export default function Dashboard({ data, month, open, navigate }) {
  const [range, setRange] = useState('six');
  const s = summarize(data, month);
  const budgetPct = s.budget ? Math.round(s.spent / s.budget * 100) : 0;
  const categoryBudgets = Object.entries(data.categoryBudgets[month] || {});
  const recent = [...s.transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const savings = s.income ? Math.round((s.income - s.spent) / s.income * 100) : 0;
  return <>
    <div className="welcome-row"><div><div className="eyebrow"><span className="status-dot"/> YOUR FINANCIAL WORKSPACE</div><h1>A little clarity. A lot of possibility<span className="green">.</span></h1><p>Welcome back, {data.user.name.split(' ')[0]}. Let’s make sense of your money.</p></div><button className="button primary" onClick={() => open('transaction')}><Icon name="plus" size={17}/> Add transaction</button></div>
    <section className="ai-overview-feature"><span><Icon name="spark" size={24}/></span><div><div className="eyebrow">FINSIGHT INTELLIGENCE</div><h2>Your financial analyst, in one place.</h2><p>{s.transactions.length ? 'Explore your spending patterns, review recurring charges, and ask questions about your money.' : 'Bring in a statement to unlock personalized analysis and a clearer plan for your money.'}</p></div><button className="button primary" onClick={() => navigate('/insights')}>Explore AI analysis<Icon name="arrowUp" size={16}/></button></section>
    <div className="stat-grid">
      <Stat title="Total balance" value={money(s.balance)} icon="wallet" footer={<><span className="mini-dot"/>{data.accounts.length} accounts, one clear picture</>}/>
      <Stat title="Money in" value={money(s.income)} icon="arrowDown" tone="green" footer={<><span className="stat-pill green"><Icon name="arrowDown" size={12}/> Income</span> this month</>}/>
      <Stat title="Money out" value={money(s.spent)} icon="arrowUp" tone="amber" footer={<><span className="stat-pill amber">{s.budget ? `${budgetPct}% of budget` : 'No budget yet'}</span> this month</>}/>
      <Stat title="You’re owed" value={money(s.shared.receive)} icon="users" tone="peach" footer={<><span className="mini-dot peach-dot"/>{s.shared.owe ? `${money(s.shared.owe)} to settle` : 'All your shares are settled'}</>}/>
    </div>
    <div className="dashboard-middle"><Panel title="Money in, money out" subtitle="Your cash flow, without the guesswork." action={<div className="segmented"><button className={range === 'month' ? 'selected' : ''} onClick={() => setRange('month')}>This month</button><button className={range === 'six' ? 'selected' : ''} onClick={() => setRange('six')}>6 months</button></div>}><div className="chart-summary"><div><span className="legend-dot green-bg"/> Income<strong>{money(s.income)}</strong></div><div><span className="legend-dot lavender-bg"/> Expenses<strong>{money(s.spent)}</strong></div><div className="savings-note"><Icon name="spark" size={15}/>{s.income ? `${savings}% saved this month` : 'Your next chapter starts here'}</div></div><CashFlowChart data={data} month={month} range={range}/></Panel>
    <Panel title="A budget that has your back" action={<button className="icon-button" aria-label="Edit monthly budget" onClick={() => open('budget')}><Icon name="edit" size={17}/></button>}><div className="budget-overview"><span><strong>{money(Math.max(0, s.budget - s.spent))}</strong> left to spend</span><span className="muted">of {money(s.budget)}</span></div><div className="progress-track main-progress"><div style={{ width: `${Math.min(budgetPct, 100)}%`, background: budgetPct > 100 ? '#d99887' : '#b5d7a0' }}/></div><div className="budget-list">{categoryBudgets.length ? categoryBudgets.slice(0, 3).map(([name, budget], i) => <BudgetBar key={name} name={name} budget={budget} spent={s.breakdown.find(c => c.name === name)?.value || 0} color={colors[i]}/>) : <p className="muted">Give your money a plan. Set your first budget.</p>}</div><button className="text-link full-link" onClick={() => navigate('/budgets')}>Explore your budgets <Icon name="chevron" size={15}/></button></Panel></div>
    <div className="dashboard-bottom"><Panel title="The latest little details" subtitle="A quick look at your recent transactions." action={<button className="text-link" onClick={() => navigate('/transactions')}>View all <Icon name="chevron" size={14}/></button>} className="recent-panel">{recent.length ? <TransactionTable transactions={recent} data={data} compact/> : <Empty title="Your story starts here" text="Add a transaction or import a statement."/>}</Panel>
    <Panel title="Better, together" subtitle="Shared moments. Sorted expenses." action={<button className="icon-button" aria-label="Create a group" onClick={() => open('group')}><Icon name="plus" size={18}/></button>}><div className="dashboard-groups">{data.groups.slice(0, 3).map((g, i) => { const b = groupBalance(g, data.user.id); return <button key={g._id} className="mini-group" onClick={() => navigate(`/groups/${g._id}`)}><span className={`group-symbol group-tone-${i}`}><Icon name={g.emoji || 'users'} size={21}/></span><span><strong>{g.name}</strong><small>{b.receive ? <span className="green">You get {money(b.receive)}</span> : b.owe ? <span className="peach">You owe {money(b.owe)}</span> : 'All settled. Good vibes.'}</small></span><GroupMembers members={g.members}/><Icon name="chevron" size={14}/></button>; })}{!data.groups.length && <Empty icon="users" title="Make room for your people" text="Create a group and share the little things."/>}</div><button className="text-link full-link" onClick={() => navigate('/groups')}>All your circles <Icon name="chevron" size={15}/></button></Panel></div>
    <div className="insight-strip"><span className="insight-symbol"><Icon name="spark" size={20}/></span><div><strong>A little insight goes a long way</strong><p>{s.income ? `You’ve kept ${money(s.income - s.spent)} of your income this month. ${s.spent < s.budget ? 'Your budget is looking healthy.' : 'Keep an eye on your spending plan.'}` : 'Bring in a statement to discover the patterns behind your spending.'}</p></div><button className="text-link" onClick={() => navigate('/insights')}>Find your insights <Icon name="arrowUp" size={16}/></button></div>
  </>;
}
function Stat({ title, value, icon, footer, tone = 'neutral' }) { return <section className={`stat-card tone-${tone}`}><div className="stat-top"><span>{title}</span><span className={`stat-icon ${tone}`}><Icon name={icon} size={17}/></span></div><div className="stat-value">{value}</div><div className="stat-footer">{footer}</div></section>; }

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { categories, money, localDate, getId } from './data';
import { API_URL, request } from './repository';

const titles = { transaction: ['arrows', 'A little detail, a clearer picture.', 'Record what came in, or what went out.'], account: ['wallet', 'Make room for an account.', 'Bring another piece of your finances into focus.'], budget: ['target', 'Give your money a little direction.', 'A plan that makes room for what matters.'], group: ['users', 'Good things are better shared.', 'Make a little space for your people.'], split: ['users', 'Share the moment. Split the bill.', 'Fair shares, without the awkward maths.'], import: ['upload', 'Bring your statement to life.', 'Review the details. Then make them part of your story.'], auth: ['shield', 'Your money, in perspective.', 'Welcome to your own financial workspace.'], delete: ['trash', 'Remove this transaction?', 'This removes the transaction from your account totals and budgets.'] };

export default function Dialogs({ dialog, close, data, month, mode, token, mutate, notify, onLogin }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const ref = useRef(null), previousFocus = useRef(document.activeElement);
  const [icon, title, description] = titles[dialog.type];
  useEffect(() => {
    const previous = previousFocus.current;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const first = ref.current.querySelector('input, select, button'); first?.focus();
    return () => { document.body.style.overflow = bodyOverflow; previous?.focus(); };
  }, []);
  const run = async task => { setBusy(true); setError(''); try { await task(); } catch (e) { setError(e.message || 'Something went wrong. Try again.'); } finally { setBusy(false); } };
  const save = (operation, payload, message) => run(async () => { await mutate(operation, payload); notify(message); close(); });
  const onKeyDown = e => {
    if (e.key === 'Escape' && !busy) close();
    if (e.key !== 'Tab') return;
    const items = [...ref.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]')];
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
  };
  const common = { busy, save, data, month, dialog, mode, run };
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget && !busy) close(); }}><section ref={ref} className={`modal ${dialog.type === 'import' ? 'wide-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title" onKeyDown={onKeyDown}><button className="icon-button modal-close" aria-label="Close dialog" disabled={busy} onClick={close}><Icon name="close"/></button><span className="modal-emblem"><Icon name={icon} size={23}/></span><h2 id="dialog-title">{title}</h2><p className="modal-description">{description}</p>{error && <div className="form-error" role="alert"><Icon name="help" size={17}/>{error}</div>}{dialog.type === 'transaction' && <TransactionForm {...common}/>} {dialog.type === 'account' && <AccountForm {...common}/>} {dialog.type === 'budget' && <BudgetForm {...common}/>} {dialog.type === 'group' && <GroupForm {...common} mode={mode}/>} {dialog.type === 'split' && <SplitForm {...common}/>} {dialog.type === 'import' && <ImportForm {...common} mode={mode} token={token} run={run}/>} {dialog.type === 'auth' && <AuthForm busy={busy} run={run} onLogin={onLogin} close={close}/>} {dialog.type === 'delete' && <><div className="delete-detail"><strong>{dialog.transaction.title}</strong><span>{money(dialog.transaction.amount)}</span></div><div className="form-footer"><button className="button" onClick={close} disabled={busy}>Keep transaction</button><button className="button danger" disabled={busy} onClick={() => run(async () => { await dialog.onConfirm(); close(); })}>{busy ? 'Removing…' : 'Remove transaction'}</button></div></>}</section></div>;
}
function Submit({ busy, children = 'Save changes', icon = 'check' }) { return <button className="button primary submit-button" disabled={busy}>{busy ? <><span className="spinner"/> Working…</> : <>{children}<Icon name={icon} size={17}/></>}</button>; }
function TransactionForm({ data, dialog, save, busy, run }) {
  const t = dialog.transaction;
  const [type, setType] = useState(t?.transactionType || 'expense');
  const submit = async e => {
    e.preventDefault(); const form = Object.fromEntries(new FormData(e.currentTarget));
    const file = form.image;
    if (!file?.size) delete form.image;
    else if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { await run(async () => { throw new Error('Use a PNG, JPG or WebP receipt smaller than 2 MB.'); }); return; }
    save('transaction', { ...form, transactionType: type, amount: Number(form.amount), ...(t ? { _id: t._id } : {}) }, t ? 'Transaction updated. A little more clarity.' : 'Transaction added. Every detail counts.');
  };
  return <form onSubmit={submit} className="dialog-form">
    <div className="type-toggle"><button type="button" className={type === 'expense' ? 'selected' : ''} onClick={() => setType('expense')}><Icon name="arrowUp" size={17}/> Money out</button><button type="button" className={type === 'income' ? 'selected' : ''} onClick={() => setType('income')}><Icon name="arrowDown" size={17}/> Money in</button></div>
    <label>Description<input name="title" placeholder="Coffee, groceries, a little treat…" defaultValue={t?.title} required maxLength={200}/></label>
    <div className="form-grid"><label>Amount (₹)<input name="amount" type="number" placeholder="0.00" min="0.01" max="999999999" step="0.01" required defaultValue={t?.amount}/></label><label>Date<input name="date" type="date" required defaultValue={t?.date.slice(0, 10) || localDate()}/></label></div>
    <label>Category<select name="category" defaultValue={t?.category || (type === 'income' ? 'Salary' : 'Food & drinks')} key={type}>{[...new Set([...categories, ...data.categories, t?.category].filter(Boolean))].map(c => <option key={c}>{c}</option>)}</select></label>
    <label>Account<select name="account" defaultValue={getId(t?.account) || data.accounts[0]?._id || ''}><option value="">Unassigned</option>{data.accounts.map(a => <option key={a._id} value={a._id}>{a.name} · {a.institution || a.type}</option>)}</select></label>
    {t?.image && <img className="receipt-preview" alt={`Receipt for ${t.title}`} src={t.image.startsWith('/uploads/') ? `${API_URL.replace(/\/api\/?$/, '')}${t.image}` : t.image}/>}
    <label>Receipt <span className="optional">Optional · PNG, JPG or WebP, up to 2 MB</span><input type="file" name="image" accept="image/png,image/jpeg,image/webp"/></label>
    <Submit busy={busy}>{t ? 'Save transaction' : 'Add transaction'}</Submit>
  </form>;
}
function AccountForm({ save, busy }) {
  return <form className="dialog-form" onSubmit={e => { e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget)); save('account', { ...values, openingBalance: Number(values.openingBalance) }, 'Account added. Your picture just got a little bigger.'); }}><label>Account name<input name="name" placeholder="Everyday account" required maxLength={80}/></label><div className="form-grid"><label>Institution<input name="institution" placeholder="HDFC Bank" maxLength={80}/></label><label>Account type<select name="type">{['Bank', 'Credit card', 'Cash', 'Investment'].map(t => <option key={t}>{t}</option>)}</select></label></div><div className="form-grid"><label>Opening balance (₹)<input name="openingBalance" type="number" step="0.01" required defaultValue="0"/></label><label>Last four digits <span className="optional">Optional</span><input name="lastFour" placeholder="4821" inputMode="numeric" pattern="[0-9]{4}" maxLength={4}/></label></div><p className="form-hint">Use the balance before the earliest transactions you plan to add or import, so it isn’t counted twice.</p><Submit busy={busy}>Add account</Submit></form>;
}
function BudgetForm({ save, busy, dialog, data, month }) {
  const [category, setCategory] = useState(dialog.category || '');
  return <form className="dialog-form" onSubmit={e => { e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget)); save('budget', { ...values, category, amount: Number(values.amount) }, 'Budget updated. A little intention goes a long way.'); }}><label>Plan for<select value={category} onChange={e => setCategory(e.target.value)}><option value="">Overall monthly budget</option>{[...new Set([...categories.filter(c => !['Salary', 'Other income'].includes(c)), ...data.categories])].map(c => <option key={c}>{c}</option>)}</select></label><label>Month<input type="month" name="month" defaultValue={month} required/></label><label>Spending limit (₹)<input type="number" name="amount" min="1" max="999999999" step="0.01" required key={category} defaultValue={category ? data.categoryBudgets[month]?.[category] || '' : data.budgets[month] || ''} placeholder="A number that feels right for you"/></label><p className="form-hint">Category limits are independent targets inside your monthly plan.</p><Submit busy={busy}>Save your plan</Submit></form>;
}
function GroupForm({ save, busy }) {
  return <form className="dialog-form" onSubmit={e => { e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget)); save('group', { name: values.name, emails: values.emails.split(/[\s,;]+/).filter(Boolean).map(e => e.toLowerCase()) }, 'Your new circle is ready.'); }}><label>Give your circle a name<input name="name" placeholder="The apartment, Goa trip, weekend people…" maxLength={80} required/></label><label>Your people <span className="optional">Email addresses</span><textarea name="emails" placeholder="arjun@example.com, priya@example.com" rows={3}/></label><p className="form-hint">Separate email addresses with commas. Each person needs an existing Finsight account. You’re automatically included.</p><Submit busy={busy}>Create your circle</Submit></form>;
}
function SplitForm({ dialog, save, busy, data }) {
  const group = dialog.group;
  const [amount, setAmount] = useState(''), [payer, setPayer] = useState(data.user.id), [method, setMethod] = useState('equal'), [selected, setSelected] = useState(group.members.map(getId)), [custom, setCustom] = useState({});
  const totalCents = Math.round(Number(amount || 0) * 100);
  const shares = selected.map((user, i) => ({ user, amount: method === 'equal' ? (Math.floor(totalCents / (selected.length || 1)) + (i < totalCents % selected.length ? 1 : 0)) / 100 : Number(custom[user] || 0) }));
  const sum = shares.reduce((s, share) => s + Math.round(share.amount * 100), 0);
  const valid = selected.length && totalCents > 0 && sum === totalCents;
  return <form className="dialog-form" onSubmit={e => { e.preventDefault(); if (!valid) return; const title = new FormData(e.currentTarget).get('title'); save('split', { groupId: group._id, title, amount: totalCents / 100, payer, splits: shares }, 'Expense shared. We’ve handled the maths.'); }}><label>What was it for?<input name="title" required maxLength={200} placeholder="A weekend stay, a really good dinner…"/></label><div className="form-grid"><label>Total amount (₹)<input value={amount} onChange={e => setAmount(e.target.value)} required min="0.01" max="999999999" step="0.01" type="number" placeholder="0.00"/></label><label>Paid by<select value={payer} onChange={e => setPayer(e.target.value)}>{group.members.map(m => <option value={getId(m)} key={getId(m)}>{getId(m) === data.user.id ? 'You' : m.name}</option>)}</select></label></div><div className="type-toggle"><button type="button" className={method === 'equal' ? 'selected' : ''} onClick={() => setMethod('equal')}>Split equally</button><button type="button" className={method === 'custom' ? 'selected' : ''} onClick={() => setMethod('custom')}>Custom amounts</button></div><div className="split-form-members">{group.members.map(m => <div key={getId(m)}><label><input type="checkbox" checked={selected.includes(getId(m))} onChange={e => setSelected(e.target.checked ? [...selected, getId(m)] : selected.filter(s => s !== getId(m)))}/>{m.name}{getId(m) === data.user.id && <span className="muted"> (you)</span>}</label>{selected.includes(getId(m)) && (method === 'equal' ? <strong>{money(shares.find(s => s.user === getId(m))?.amount)}</strong> : <input type="number" aria-label={`${m.name}'s share`} min="0" step="0.01" value={custom[getId(m)] || ''} placeholder="0.00" onChange={e => setCustom({ ...custom, [getId(m)]: e.target.value })}/>)}</div>)}</div>{method === 'custom' && <p className={valid ? 'green form-hint' : 'peach form-hint'}>{money(sum / 100)} of {money(totalCents / 100)} assigned</p>}<p className="form-hint">Each person’s share is counted once in their spending. Settlements track who still needs to reimburse the payer.</p><Submit busy={busy || !valid}>Share the expense</Submit></form>;
}
function ImportForm({ data, busy, run, save, token }) {
  const [preview, setPreview] = useState(null), [account, setAccount] = useState(data.accounts[0]?._id || ''), [useAI, setUseAI] = useState(true), [aiStatus, setAiStatus] = useState(null);
  const input = useRef(null);
  useEffect(() => {
    let active = true;
    request('/ai/status', {}, token).then(value => { if (active) { setAiStatus(value); if (!value.configured) setUseAI(false); } }).catch(() => { if (active) { setAiStatus({ configured: false }); setUseAI(false); } });
    return () => { active = false; };
  }, [token]);
  const read = file => run(async () => {
    setPreview(null); if (!file) return;
    if (file.size > 5 * 1024 * 1024) throw new Error('Choose a statement smaller than 5 MB.');
    if (!/\.(csv|pdf)$/i.test(file.name)) throw new Error('Choose a CSV or PDF file.');
    const form = new FormData(); form.append('file', file); form.append('useAI', String(useAI)); setPreview(await request('/workspace/statements/preview', { method: 'POST', body: form, timeout: 600000 }, token));
  });
  return <div className="dialog-form">
    <label>Import into<select value={account} onChange={e => setAccount(e.target.value)} required disabled={busy}><option value="">Choose an account</option>{data.accounts.map(a => <option value={a._id} key={a._id}>{a.name}</option>)}</select></label>
    {!data.accounts.length && <p className="notice">Create an account first, then come back to import your statement.</p>}
    <div className="ai-import-option"><label><input type="checkbox" checked={useAI} disabled={busy || !aiStatus?.configured} onChange={e => { setUseAI(e.target.checked); setPreview(null); }}/><Icon name="spark" size={17}/><span>AI extraction & category suggestions</span></label><p>{!aiStatus ? 'Checking your AI provider…' : aiStatus.configured ? `When enabled, statement text is sent to ${aiStatus.provider} for analysis. Review the suggestions before importing.` : 'Configure your AI provider to enable intelligent statement extraction. Standard CSV import is available.'}</p></div>
    <input ref={input} type="file" accept=".csv,.pdf" className="file-input" aria-label="Choose a bank statement" onChange={e => read(e.target.files[0])} disabled={busy}/>
    <button className="file-picker" disabled={busy || !aiStatus} onClick={() => input.current.click()}>{busy && !preview ? <span className="spinner"/> : <Icon name={useAI ? 'spark' : 'upload'} size={23}/>}<strong>{busy && !preview ? useAI ? 'AI is reading your statement…' : 'Reading your statement…' : preview ? preview.name : 'Choose your CSV or text PDF'}</strong><span>{busy ? 'Larger statements may take a few minutes' : 'Click to browse · Up to 5 MB'}</span></button>
    <p className="form-hint">CSV: <code>date, description, amount, type</code> (INCOME or EXPENSE). With AI enabled, text-based PDFs can use other bank layouts. Scanned or image-only PDFs need OCR first. Standard PDF import requires YYYY-MM-DD description amount CR/DR.</p>
    {preview && <><div className="preview-heading"><span className="status-badge"><Icon name="check" size={13}/>{preview.rows.length} transactions ready</span><span className="muted">{preview.analysisMethod === 'ai' ? 'AI suggestions · please review' : 'Standard import · merchant rules'}</span></div><div className="import-preview"><table><thead><tr><th>Description</th><th>Category</th><th>Amount</th></tr></thead><tbody>{preview.rows.slice(0, 30).map((r, i) => <tr key={i}><td><strong>{r.title}</strong><small>{r.date.slice(0, 10)}</small></td><td><select aria-label={`Category for ${r.title}`} value={r.category} disabled={busy} onChange={e => setPreview(prev => ({ ...prev, rows: prev.rows.map((row, j) => j === i ? { ...row, category: e.target.value, categorySource: 'manual', aiConfidence: null } : row) }))}>{[...new Set([...categories, r.category])].map(c => <option key={c}>{c}</option>)}</select>{r.aiConfidence != null && <small>AI confidence: {Math.round(r.aiConfidence * 100)}%</small>}</td><td className={r.transactionType === 'income' ? 'green' : ''}>{r.transactionType === 'income' ? '+' : '−'}{money(r.amount)}</td></tr>)}</tbody></table></div>{preview.rows.length > 30 && <p className="form-hint">Showing the first 30 of {preview.rows.length} validated rows. All rows will be imported.</p>}<button className="button primary submit-button" disabled={busy || !account} onClick={() => save('import', { ...preview, account }, `${preview.rows.length} transactions imported. Your picture is up to date.`)}>{busy ? 'Importing…' : `Import ${preview.rows.length} transactions`}<Icon name="check" size={17}/></button></>}
  </div>;
}
export function AuthForm({ busy, run, onLogin, close }) {
  const [register, setRegister] = useState(false);
  return <form className="dialog-form" onSubmit={e => { e.preventDefault(); const values = Object.fromEntries(new FormData(e.currentTarget)); run(async () => { const result = await request(`/auth/${register ? 'signup' : 'login'}`, { method: 'POST', body: JSON.stringify(values) }); await onLogin(result); close(); }); }}><div className="type-toggle"><button type="button" className={!register ? 'selected' : ''} onClick={() => setRegister(false)}>Sign in</button><button type="button" className={register ? 'selected' : ''} onClick={() => setRegister(true)}>Create account</button></div>{register && <><label>Your name<input name="name" required maxLength={80} autoComplete="name"/></label><label>Phone number<input name="phone_number" type="tel" required pattern="[0-9+\s-]{10,16}" autoComplete="tel"/></label></>}<label>Email address<input name="email" type="email" required autoComplete="email"/></label><label>Password<input name="password" type="password" required minLength={register ? 8 : 1} autoComplete={register ? 'new-password' : 'current-password'}/></label><Submit busy={busy} icon="arrowUp">{register ? 'Create your account' : 'Sign in to Finsight'}</Submit><p className="form-hint">Your personal workspace starts empty. Add your accounts, transactions and budgets after signing in.</p></form>;
}

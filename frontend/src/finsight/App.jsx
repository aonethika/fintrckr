import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, useLocation, useNavigate } from 'react-router-dom';
import AuthPage from './AuthPage';
import Dashboard from './Dashboard';
import { Accounts, Budgets, GroupDetail, Groups, Settings, Statements, Transactions } from './Pages';
import Analysis from './Analysis';
import Dialogs from './Dialogs';
import Icon from './Icon';
import { Avatar, Brand, Empty } from './UI';
import { monthKey } from './data';
import { liveMutation, request } from './repository';
import './theme.css';
import './matte.css';
import './premium.css';

const navigation = [
  ['YOUR WORKSPACE', [['/insights', 'spark', 'AI analysis'], ['/dashboard', 'grid', 'Overview'], ['/transactions', 'arrows', 'Transactions'], ['/accounts', 'wallet', 'Accounts'], ['/budgets', 'target', 'Budgets']]],
  ['MANAGE & SHARE', [['/groups', 'users', 'Shared groups'], ['/statements', 'file', 'Statements']]],
];
const pageTitles = { dashboard: 'Overview', transactions: 'Transactions', accounts: 'Accounts', budgets: 'Budgets', insights: 'AI analysis', groups: 'Shared groups', statements: 'Statements', settings: 'Settings' };
function readSession() { try { return JSON.parse(localStorage.getItem('finsight-session')) || null; } catch { return null; } }
const emptyWorkspace = () => ({ user: { id: '', name: '', email: '' }, accounts: [], transactions: [], groups: [], statements: [], budgets: {}, categoryBudgets: {}, categories: [] });
export default function App() { return <BrowserRouter><Workspace/></BrowserRouter>; }
function Workspace() {
  const [session, setSession] = useState(readSession), [data, setData] = useState(emptyWorkspace), [month, setMonth] = useState(monthKey), [dialog, setDialog] = useState(null), [mobile, setMobile] = useState(false), [toast, setToast] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(Boolean(session)), [reload, setReload] = useState(0);
  const dataRef = useRef(data), toastTimer = useRef(null), mutationBusy = useRef(false);
  const location = useLocation(), navigate = useNavigate();
  const mode = 'live';
  const page = location.pathname.split('/')[1] || 'dashboard';
  const groupId = location.pathname.split('/')[2];
  const notify = (text, type = 'success') => { setToast({ text, type }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 5000); };
  const open = (type, options = {}) => setDialog({ type, ...options });
  useEffect(() => { document.title = `${pageTitles[page] || 'Workspace'} · Finsight`; }, [page]);
  useEffect(() => {
    if (!session) return;
    let active = true;
    request('/workspace', {}, session.token).then(value => { if (active) { dataRef.current = value; setData(value); setError(''); setLoading(false); } }).catch(e => { if (active) { setError(e.message); setLoading(false); } });
    return () => { active = false; };
  }, [session, reload]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const go = path => { setMobile(false); navigate(path); };
  const mutate = async (operation, payload) => {
    if (!session) throw new Error('Please sign in to save your changes.');
    if (mutationBusy.current) throw new Error('Another change is being saved. Please try again in a moment.');
    mutationBusy.current = true;
    try { const value = await liveMutation(operation, payload, session.token); dataRef.current = value; setData(value); return value; } finally { mutationBusy.current = false; }
  };
  const login = async result => {
    const value = await request('/workspace', {}, result.token);
    const next = { token: result.token, user: result.user };
    localStorage.setItem('finsight-session', JSON.stringify(next));
    dataRef.current = value; setData(value); setSession(next); setError(''); setLoading(false); go('/insights'); notify('Welcome home. Your workspace is ready.');
  };
  const logout = () => { localStorage.removeItem('finsight-session'); setSession(null); const value = emptyWorkspace(); dataRef.current = value; setData(value); setDialog(null); setError(''); setLoading(false); go('/login'); };
  const props = { data, month, open, mutate, notify, navigate: go, mode };
  const retry = () => { setLoading(true); setError(''); setReload(r => r + 1); };
  const content = () => {
    if (loading) return <div className="loading-state"><span className="spinner"/><p>Finding a little clarity…</p></div>;
    if (error) return <Empty icon="help" title="Let’s reconnect" text={error} action={<div className="button-row"><button className="button primary" onClick={retry}>Try again</button><button className="button" onClick={logout}>Back to sign in</button></div>}/>;
    switch (page) {
      case 'dashboard': return <Dashboard {...props}/>;
      case 'transactions': return <Transactions {...props}/>;
      case 'accounts': return <Accounts {...props}/>;
      case 'budgets': return <Budgets {...props}/>;
      case 'groups': return groupId ? <GroupDetail key={groupId} {...props} groupId={groupId}/> : <Groups {...props}/>;
      case 'statements': return <Statements {...props}/>;
      case 'insights': return <Analysis key={month} {...props} token={session.token}/>;
      case 'settings': return <Settings key={mode} {...props} logout={logout}/>;
      default: return <Empty title="A little detour" text="This page doesn’t exist. Your workspace is waiting." action={<button className="button" onClick={() => go('/dashboard')}>Back to overview</button>}/>;
    }
  };
  if (!session) return location.pathname === '/login' ? <AuthPage onLogin={login}/> : <Navigate to="/login" replace/>;
  if (location.pathname === '/login' || location.pathname === '/') return <Navigate to="/insights" replace/>;
  return <div className="finsight-app">
    {mobile && <button className="sidebar-overlay" aria-label="Close navigation" onClick={() => setMobile(false)}/>}
    <aside className={`sidebar ${mobile ? 'mobile-open' : ''}`}>
      <a className="brand-link" href="/dashboard" onClick={e => { e.preventDefault(); go('/dashboard'); }}><Brand/></a>
      <div className="workspace-label"><span className="workspace-avatar">{data.user.name[0] || 'F'}</span><div><strong>{data.user.name.split(' ')[0] || 'Your workspace'}</strong><span>Your money, together</span></div><Icon name="down" size={14}/></div>
      <nav aria-label="Main navigation">{navigation.map(([label, links]) => <div className="nav-section" key={label}><div className="nav-label">{label}</div>{links.map(([path, icon, title]) => <NavLink key={path} to={path} onClick={() => setMobile(false)} className={({ isActive }) => `nav-link ${isActive || page === 'dashboard' && path === '/dashboard' ? 'active' : ''}`}><Icon name={icon} size={19}/><span>{title}</span>{path === '/insights' && <span className="nav-new">NEW</span>}{path === '/groups' && data.groups.length > 0 && <span className="nav-count">{data.groups.length}</span>}</NavLink>)}</div>)}</nav>
      <div className="sidebar-bottom"><div className="quiet-card"><span className="quiet-icon"><Icon name="spark" size={19}/></span><strong>A little more clarity.</strong><p>Your money makes more sense when it’s all together.</p><button className="text-link" onClick={() => { setMobile(false); open('import'); }}>Bring in a statement <Icon name="arrowUp" size={14}/></button></div><NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={() => setMobile(false)}><Icon name="settings" size={19}/><span>Settings</span></NavLink><button className="profile-button" onClick={() => go('/settings')}><Avatar name={data.user.name}/><span><strong>{data.user.name}</strong><small>Personal account</small></span><Icon name="down" size={15}/></button></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMobile(true)}><Icon name="menu"/></button><span className="muted">Workspace</span><Icon name="chevron" size={13}/><span>{pageTitles[page] || 'Overview'}</span></div><div className="topbar-actions"><span className="demo-badge live"><span className="status-dot"/>Personal workspace</span><label className="month-picker"><Icon name="calendar" size={16}/><input type="month" aria-label="Selected month" value={month} onChange={e => { if (e.target.value) setMonth(e.target.value); }}/></label><button className="icon-button" onClick={logout} aria-label="Sign out"><Icon name="logout" size={18}/></button></div></header><main key={page} className="main-content">{content()}<footer className="app-footer"><span>Made for a little more peace of mind.</span><span><span className="status-dot"/> Your money, in perspective.</span></footer></main></div>
    {dialog && <Dialogs key={`${dialog.type}-${dialog.transaction?._id || ''}`} dialog={dialog} close={() => setDialog(null)} {...props} token={session.token} onLogin={login}/>}
    {toast && <div className={`toast ${toast.type}`} role="status"><Icon name={toast.type === 'error' ? 'help' : 'check'} size={18}/><span>{toast.text}</span><button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast(null)}><Icon name="close" size={15}/></button></div>}
  </div>;
}

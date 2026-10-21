import { useState } from 'react';
import { Brand } from './UI';
import Icon from './Icon';
import { AuthForm } from './Dialogs';

export default function AuthPage({ onLogin }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const run = async task => {
    setBusy(true); setError('');
    try { await task(); }
    catch (error) { setError(error.message === 'Failed to fetch' ? 'Unable to reach Finsight. Check that the local API is running on port 5050.' : error.message); }
    finally { setBusy(false); }
  };
  return <main className="auth-page"><section className="auth-story"><Brand/><div><div className="eyebrow"><span className="status-dot"/> YOUR FINANCIAL WORKSPACE</div><h1>Your money,<br/>in perspective<span className="green">.</span></h1><p>Understand your spending, analyze your statements, and plan your next step with AI.</p><div className="auth-features"><span><Icon name="wallet" size={18}/> AI analysis, grounded in your data</span><span><Icon name="target" size={18}/> A smarter plan for what matters</span><span><Icon name="users" size={18}/> Shared moments. Sorted expenses.</span></div></div><small>Made for a little more peace of mind.</small></section><section className="auth-card panel"><span className="modal-emblem"><Icon name="shield" size={24}/></span><h2>Make yourself at home.</h2><p className="modal-description">Sign in or create your own Finsight account.</p>{error && <div className="form-error" role="alert"><Icon name="help" size={17}/>{error}</div>}<AuthForm busy={busy} run={run} onLogin={onLogin} close={() => {}}/></section></main>;
}

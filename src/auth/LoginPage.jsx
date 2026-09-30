import React, { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import { extractErrorMessage } from '../api/client.js';
import Icon from '../components/Icon.jsx';
import LanguageSwitcher from '../components/LanguageSwitcher.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [showPwd, setShowPwd]         = useState(false);
  const [capsLock, setCapsLock]       = useState(false);
  const [error, setError]             = useState(null);
  const [submitting, setSubmitting]   = useState(false);
  const pwdRef = useRef(null);
  const from   = location.state?.from?.pathname || '/';

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null); setSubmitting(true);
    try   { await login(email, password); navigate(from, { replace: true }); }
    catch (err) { setError(extractErrorMessage(err)); }
    finally     { setSubmitting(false); }
  }

  function togglePwd() {
    setShowPwd(v => !v);
    requestAnimationFrame(() => pwdRef.current?.focus());
  }

  return (
    <div className="flex min-h-screen" style={{ background: '#f5f5dc' }}>

      {/* ── Brand panel (lg+) ──────────────────────────────────────────── */}
      <aside
        className="relative hidden w-[46%] max-w-xl shrink-0 overflow-hidden lg:flex lg:flex-col lg:justify-between"
        style={{ background: '#7a7d55' }}
      >
        {/* Grid texture */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)', backgroundSize: '42px 42px' }} />
        {/* Soft glow */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0"
          style={{ background: 'radial-gradient(60% 50% at 15% 0%,rgba(255,255,210,0.18) 0%,transparent 65%)' }} />

        <div className="relative px-10 pt-10">
          <Brandmark dark />
        </div>

        <div className="relative px-10 pb-14">
          <h2 style={{ fontFamily: '"Cormorant Garamond",Georgia,serif', fontSize: 32, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
            Every branch,<br />every number,<br />in one place.
          </h2>
          <p className="mt-4 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.72)', fontFamily: 'Inter,sans-serif', maxWidth: 340 }}>
            Stock, sales, purchasing and finance stay in sync across your stores and warehouses — in real time.
          </p>
          <ul className="mt-8 space-y-3">
            {['Live multi-branch stock and transfers','Point of sale with instant costing','Expenses and profit in one ledger'].map(line => (
              <li key={line} className="flex items-center gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.85)', fontFamily: 'Inter,sans-serif' }}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.22)' }}>
                  <Icon name="check" size={11} strokeWidth={2.5} className="text-white" />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative px-10 py-5 text-xs" style={{ borderTop: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.42)', fontFamily: 'Inter,sans-serif' }}>
          Multi-Branch Store &amp; Warehouse ERP
        </div>
      </aside>

      {/* ── Form panel ─────────────────────────────────────────────────── */}
      <main className="relative flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
        <div className="absolute right-4 top-4"><LanguageSwitcher /></div>
        <div className="w-full max-w-[390px]">
          <div className="mb-8 lg:hidden"><Brandmark /></div>

          <h1 style={{ fontFamily: '"Cormorant Garamond",Georgia,serif', fontSize: 34, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
            Sign in
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif' }}>
            Welcome back. Enter your details to continue.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate={false}>
            {/* Email */}
            <div>
              <label htmlFor="email" className="label">Email</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center" style={{ color: '#a3a676' }}>
                  <Icon name="mail" size={16} />
                </span>
                <input id="email" type="email" required autoFocus autoComplete="username" spellCheck="false"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="input pl-10" placeholder="you@company.com"
                  aria-invalid={error ? 'true' : undefined} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center" style={{ color: '#a3a676' }}>
                  <Icon name="lock" size={16} />
                </span>
                <input id="password" ref={pwdRef}
                  type={showPwd ? 'text' : 'password'}
                  required autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  onKeyUp={e => setCapsLock(e.getModifierState?.('CapsLock') ?? false)}
                  className="input pl-10 pr-12" placeholder="••••••••"
                  aria-invalid={error ? 'true' : undefined} />
                {/* type=button prevents form submission */}
                <button type="button" onClick={togglePwd} tabIndex={-1}
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                  aria-pressed={showPwd}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg transition"
                  style={{ color: showPwd ? '#a3a676' : '#b8b498' }}>
                  <Icon name={showPwd ? 'eye-off' : 'eye'} size={18} />
                </button>
              </div>
              {capsLock && (
                <p className="field-hint mt-1.5 flex items-center gap-1 text-amber-700">
                  <Icon name="warning" size={12} /> Caps Lock is on
                </p>
              )}
            </div>

            {error && (
              <div className="alert alert-error animate-fade-in" role="alert">
                <Icon name="error" size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={submitting} className="btn btn-lg w-full"
              style={{ background: '#a3a676', color: '#fff', fontFamily: 'Inter,sans-serif' }}>
              {submitting
                ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" /> Signing in...</>
                : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'Inter,sans-serif' }}>
            Trouble signing in? Contact your system administrator.
          </p>
        </div>
      </main>
    </div>
  );
}

function Brandmark({ dark = false }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-xs ring-1"
        style={{ background: dark ? 'rgba(255,255,255,0.22)' : '#7a7d55', ringColor: dark ? 'rgba(255,255,255,0.25)' : 'rgba(163,166,118,0.4)' }}>
        <Icon name="inventory" size={20} strokeWidth={2} />
      </span>
      <div>
        <p style={{ fontFamily: '"Cormorant Garamond",Georgia,serif', fontSize: 17, fontWeight: 600, color: dark ? '#fff' : 'var(--text)', letterSpacing: '-0.01em' }}>
          ERP Suite
        </p>
        <p style={{ fontFamily: 'Inter,sans-serif', fontSize: 11, color: dark ? 'rgba(255,255,255,0.58)' : 'var(--text-muted)' }}>
          Store &amp; Warehouse
        </p>
      </div>
    </div>
  );
}

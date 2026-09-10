import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Check, ChevronRight, CircleUserRound, Command, Eye, EyeOff, LockKeyhole, Mail, MapPinned, Radio, RefreshCw, ShieldCheck, Sparkles, UserRound, Users, XCircle } from 'lucide-react';
import './style.css';
import CommandCenter from './features/command-center/CommandCenter';
import EmergencyReport from './features/emergency/EmergencyReport';
import { simulationRequest } from './core/simulation/api';
import type { SimulationResponse, SimulationState } from './core/simulation/types';

type Role = 'user' | 'author';
type Screen = 'home' | 'login' | 'register' | 'otp' | 'dashboard';
type OTPState = 'input' | 'verifying' | 'success' | 'error' | 'expired';

type StoredUser = { id: string; name: string; username: string; phone: string; email: string; passwordHash: string };

const OTP_TTL = 60_000;
const AUTHOR = { username: 'admin', password: 'CrisisMesh@2026' };

const makeOTP = () => { const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); return String(100000 + (bytes[0] % 900000)); };
const normalizeEmail = (v: string) => v.trim().toLowerCase();
const normalizePhone = (v: string) => v.replace(/\D/g, '');
const normalizeUsername = (v: string) => v.trim().toLowerCase();

async function hashText(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getUsers(): StoredUser[] {
  try { return JSON.parse(localStorage.getItem('cm-users') || '[]'); } catch { return []; }
}
function saveUsers(users: StoredUser[]) { localStorage.setItem('cm-users', JSON.stringify(users)); }

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    try {
      const session = JSON.parse(localStorage.getItem('cm-session') || 'null') as { role?: Role } | null;
      return session?.role === 'author' || session?.role === 'user' ? 'dashboard' : 'home';
    } catch {
      return 'home';
    }
  });
  const [role, setRole] = useState<Role>(() => {
    try {
      const session = JSON.parse(localStorage.getItem('cm-session') || 'null') as { role?: Role } | null;
      return session?.role === 'author' || session?.role === 'user' ? session.role : 'user';
    } catch {
      return 'user';
    }
  });
  const [authNotice, setAuthNotice] = useState('');
  const [pendingUser, setPendingUser] = useState<StoredUser | null>(null);

  const goHome = () => { localStorage.removeItem('cm-session'); setAuthNotice(''); setScreen('home'); };
  const startLogin = (nextRole: Role) => { setRole(nextRole); setAuthNotice(''); setScreen('login'); };

  const completeOTP = async () => {
    if (pendingUser) {
      const users = getUsers();
      saveUsers([...users.filter((u) => u.id !== pendingUser.id), pendingUser]);
      setPendingUser(null);
    }
    localStorage.setItem('cm-session', JSON.stringify({ role, establishedAt: Date.now() }));
    setScreen('dashboard');
  };

  return (
    <AnimatePresence mode="wait">
      {screen === 'home' && <Home key="home" onLogin={startLogin} />}
      {screen === 'login' && <Login key="login" role={role} onBack={goHome} onRegister={() => { setAuthNotice(''); setScreen('register'); }} onContinue={() => setScreen('otp')} notice={authNotice} setNotice={setAuthNotice} />}
      {screen === 'register' && <Register key="register" onBack={() => setScreen('login')} onCreated={(user) => { setPendingUser(user); setRole('user'); setScreen('otp'); }} />}
      {screen === 'otp' && <OTP key="otp" role={role} back={() => setScreen(role === 'user' && pendingUser ? 'register' : 'login')} done={completeOTP} />}
      {screen === 'dashboard' && <Dashboard key="dashboard" role={role} onHome={goHome} />}
    </AnimatePresence>
  );
}

function Shell({ children, eyebrow = 'CRISISMESH / AUTHENTICATION', onBack, variant = 'default' }: { children: React.ReactNode; eyebrow?: string; onBack?: () => void; variant?: 'default' | 'verification' }) {
  return <main className={`auth-page ${variant === 'verification' ? 'verification-page' : ''}`}><AmbientNetwork verification={variant === 'verification'} /><header className="brandbar"><button className="brand" onClick={() => onBack?.()}><span className="brand-mark"><Radio size={17} /></span><span>CRISISMESH</span></button><div className="brand-status"><i /> C++ SIMULATION DEVELOPMENT BRIDGE <b>DEVELOPMENT MODE</b></div></header><div className="auth-wrap"><motion.div className="auth-card" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .45 }}>{children}</motion.div></div><footer className="auth-footer"><span>DSA-POWERED EMERGENCY COORDINATION SIMULATOR</span><span>FINAL / DEMO ACCESS</span></footer></main>;
}

function AmbientNetwork({ verification = false }: { verification?: boolean }) {
  const points = useMemo(() => Array.from({ length: 18 }, (_, i) => ({ left: `${8 + ((i * 37) % 86)}%`, top: `${12 + ((i * 53) % 76)}%`, delay: `${(i % 5) * .7}s` })), []);
  return <div className={`ambient ${verification ? 'ambient-verification' : ''}`} aria-hidden="true"><div className="ambient-grid"/><div className="ambient-glow"/>{verification && <><div className="cityline cityline-a"/><div className="cityline cityline-b"/><div className="network-arc arc-a"/><div className="network-arc arc-b"/><div className="signal-marker marker-med">+</div><div className="signal-marker marker-alert">!</div><div className="signal-marker marker-core">⌁</div></>}{points.map((p, i) => <span key={i} className="node" style={p} />)}</div>;
}

function Home({ onLogin }: { onLogin: (role: Role) => void }) {
  return <main className="home-page"><AmbientNetwork /><nav className="home-nav"><div className="brand"><span className="brand-mark"><Radio size={18} /></span><span>CRISISMESH</span></div><div className="nav-links" aria-label="Primary navigation"><span>Platform</span><span>Simulation</span><span>Response</span><span>Security</span></div><div className="nav-meta"><span className="status-dot"/> CITY ENGINE <em>LIVE</em></div></nav><section className="hero"><motion.div className="hero-copy-panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}><div className="eyebrow"><span>01</span> EMERGENCY RESPONSE NETWORK</div><h1 className="hero-main-headline"><span>Real-time emergency coordination.</span><span>Built for precision under pressure.</span></h1><p className="hero-copy">A high-fidelity emergency response simulator that models city-scale coordination, routing, and resource allocation in real time.</p><div className="hero-actions"><button className="role-card author" onClick={() => onLogin('author')}><span className="role-icon"><ShieldCheck size={21} /></span><span><b>Login as Author</b><small>Coordinator access and verification</small></span><ChevronRight size={18} /></button><button className="role-card" onClick={() => onLogin('user')}><span className="role-icon"><UserRound size={21} /></span><span><b>Login as User</b><small>Citizen access and incident workflow</small></span><ChevronRight size={18} /></button></div><div className="hero-trust"><div><ShieldCheck size={15}/> Deterministic routing</div><div><Check size={15}/> Simulator ready</div><div><Radio size={15}/> Live engine status</div></div></motion.div><motion.aside className="hero-panel" initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .2, duration: .55 }}><div className="panel-top"><span>NETWORK OVERVIEW</span><span className="panel-status"><i /> SIMULATOR READY</span></div><div className="network-visual"><div className="ring ring-a"/><div className="ring ring-b"/><div className="core"><Command size={20}/></div>{Array.from({length: 9}, (_, i) => <span key={i} className={`map-node n${i}`}><i/></span>)}<svg viewBox="0 0 420 330" preserveAspectRatio="none"><path d="M50 250 L120 120 L210 185 L300 80 L370 230 M120 120 L210 185 L360 115 M50 250 L210 185 L370 230"/><path d="M120 120 L300 80"/></svg></div><div className="metrics"><div><span>NETWORK</span><b>MODELED</b></div><div><span>ACCESS</span><b>SIMULATED</b></div><div><span>ENGINE</span><b>C++17</b></div></div></motion.aside></section><div className="home-bottom"><span>GRAPH / ROUTING / PRIORITY / RESOURCES</span><span>BUILT FOR DSA DEMONSTRATION</span></div></main>;
}

function TypewriterHeading({ phrases }: { phrases: string[] }) {
  const [text, setText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const phrase = phrases[phraseIndex] ?? phrases[0] ?? '';
    let charIndex = 0;
    let deleting = false;
    let timeoutId: number | undefined;

    const tick = () => {
      if (!deleting) {
        charIndex += 1;
        setText(phrase.slice(0, charIndex));
        if (charIndex >= phrase.length) {
          deleting = true;
          timeoutId = window.setTimeout(tick, 1100);
          return;
        }
      } else {
        charIndex -= 1;
        setText(phrase.slice(0, charIndex));
        if (charIndex <= 0) {
          deleting = false;
          setPhraseIndex((current) => (current + 1) % phrases.length);
          return;
        }
      }

      timeoutId = window.setTimeout(tick, deleting ? 32 : 78);
    };

    timeoutId = window.setTimeout(tick, 150);
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [phraseIndex, phrases]);

  return <h2 className="typewriter-heading">{text}</h2>;
}

function Login({ role, onBack, onRegister, onContinue, notice, setNotice }: { role: Role; onBack: () => void; onRegister: () => void; onContinue: () => void; notice: string; setNotice: (v: string) => void }) {
  const [identity, setIdentity] = useState(role === 'author' ? 'admin' : '');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity || !password) return setNotice('Please complete all required fields.');
    if (role === 'author') {
      if (normalizeUsername(identity) !== AUTHOR.username || password !== AUTHOR.password) return setNotice('Invalid coordinator credentials.');
    } else {
      const users = getUsers(); const u = users.find((x) => normalizeUsername(x.username) === normalizeUsername(identity) || normalizeEmail(x.email) === normalizeEmail(identity));
      if (!u || u.passwordHash !== await hashText(password)) return setNotice('Invalid username/email or password.');
    }
    setNotice(''); onContinue();
  };
  return <Shell onBack={onBack}><button className="back-link" onClick={onBack}><ArrowLeft size={15}/> Back to home</button><div className="auth-heading"><div className="auth-icon"><LockKeyhole size={21}/></div><div><span className="eyebrow">{role === 'author' ? 'COORDINATOR ACCESS' : 'CITIZEN ACCESS'}</span><TypewriterHeading phrases={role === 'author' ? ['INITIALIZING SECURE CONNECTION...', 'VERIFYING COORDINATOR ACCESS...', 'AUTHENTICATING NODE...'] : ['AUTHENTICATING NODE...', 'SECURE SESSION ONLINE...', 'WELCOME BACK...']} /></div></div><p className="auth-copy">{role === 'author' ? 'Authenticate the single simulation coordinator before security verification.' : 'Sign in to your CrisisMesh simulation account.'}</p>{notice && <div className="notice error"><XCircle size={16}/>{notice}</div>}<form onSubmit={submit} className="form"><label>Username or email<input autoComplete="username" value={identity} onChange={e => setIdentity(e.target.value)} placeholder={role === 'author' ? 'admin' : 'username or email'} /></label><label>Password<div className="password-wrap"><input autoComplete="current-password" type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label><button className="primary" type="submit">CONTINUE TO SECURITY <ChevronRight size={16}/></button></form>{role === 'user' && <div className="switch-line">New to CrisisMesh? <button onClick={onRegister}>Create new user ID</button></div>}<div className="demo-note"><span>DEMO CREDENTIALS</span>{role === 'author' ? <b>Seeded coordinator account: admin</b> : <small>Register an account to continue.</small>}</div></Shell>;
}

function Register({ onBack, onCreated }: { onBack: () => void; onCreated: (user: StoredUser) => void }) {
  const [f, setF] = useState({ name: '', username: '', phone: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState(''); const [show, setShow] = useState(false);
  const update = (key: keyof typeof f, value: string) => setF(v => ({ ...v, [key]: value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (Object.values(f).some(v => !v.trim())) return setError('Please complete every field.');
    if (f.username.trim().length < 3) return setError('Username must contain at least 3 characters.');
    if (!/^\S+@\S+\.\S+$/.test(f.email)) return setError('Enter a valid email address.');
    if (normalizePhone(f.phone).length < 8) return setError('Enter a valid phone number.');
    if (f.password.length < 6) return setError('Password must contain at least 6 characters.');
    if (f.password !== f.confirm) return setError('Passwords do not match.');
    const users = getUsers();
    if (users.some(u => normalizeUsername(u.username) === normalizeUsername(f.username))) return setError('An account already exists with this username. Try another username.');
    if (users.some(u => normalizePhone(u.phone) === normalizePhone(f.phone))) return setError('An account already exists with this phone number. Try another number.');
    if (users.some(u => normalizeEmail(u.email) === normalizeEmail(f.email))) return setError('An account already exists with this email. Try another email.');
    const user: StoredUser = { id: crypto.randomUUID(), name: f.name.trim(), username: f.username.trim(), phone: normalizePhone(f.phone), email: normalizeEmail(f.email), passwordHash: await hashText(f.password) };
    onCreated(user);
  };
  return <Shell onBack={onBack}><button className="back-link" onClick={onBack}><ArrowLeft size={15}/> Back to user login</button><div className="auth-heading"><div className="auth-icon"><Users size={21}/></div><div><span className="eyebrow">USER REGISTRATION</span><h2>Create your user ID</h2></div></div><p className="auth-copy">Create a demo identity to submit and track emergency requests inside the academic simulation.</p>{error && <div className="notice error"><XCircle size={16}/>{error}</div>}<form onSubmit={submit} className="form register-form"><label>Full name<input value={f.name} onChange={e => update('name', e.target.value)} placeholder="Your full name" /></label><div className="two-col"><label>Username<input value={f.username} onChange={e => update('username', e.target.value)} placeholder="Choose a username" /></label><label>Phone<input value={f.phone} onChange={e => update('phone', e.target.value)} placeholder="01XXXXXXXXX" /></label></div><label>Email<input type="email" value={f.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" /></label><div className="two-col"><label>Password<div className="password-wrap"><input type={show ? 'text' : 'password'} value={f.password} onChange={e => update('password', e.target.value)} placeholder="Min. 6 characters" /><button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label><label>Confirm password<input type={show ? 'text' : 'password'} value={f.confirm} onChange={e => update('confirm', e.target.value)} placeholder="Repeat password" /></label></div><button className="primary" type="submit">CONTINUE TO VERIFICATION <ChevronRight size={16}/></button></form></Shell>;
}

function OTP({ role, back, done }: { role: Role; back: () => void; done: () => void }) {
  const [code, setCode] = useState(makeOTP);
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [state, setState] = useState<OTPState>('input');
  const [expires, setExpires] = useState(() => Date.now() + OTP_TTL);
  const [tries, setTries] = useState(0);
  const MAX_OTP_ATTEMPTS = 5;
  const [redirectSeconds, setRedirectSeconds] = useState(3);
  const [, setClock] = useState(Date.now());
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const reduce = useReducedMotion();

  // A single UI clock drives the visible countdown. It is the only active
  // countdown interval; the actual expiry check is performed from this clock.
  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  const seconds = Math.max(0, Math.ceil((expires - Date.now()) / 1000));

  // Expire only while the user is allowed to enter a code. Once verification
  // has started, this effect never overwrites verifying/success state.
  useEffect(() => {
    if (state !== 'input' && state !== 'error') return;
    if (Date.now() >= expires) {
      setState('expired');
      return;
    }
    const id = window.setTimeout(() => {
      if (Date.now() >= expires) setState('expired');
    }, Math.max(0, expires - Date.now()) + 10);
    return () => window.clearTimeout(id);
  }, [expires, state]);

  // IMPORTANT: validation is scheduled AFTER the component enters the
  // verifying state. The previous implementation scheduled the timeout in an
  // effect that also depended on `state`; changing input -> verifying caused
  // React to clean up that effect and cancel its own validation timeout.
  useEffect(() => {
    if (state !== 'verifying') return;

    const enteredCode = digits.join('');
    const timer = window.setTimeout(() => {
      if (Date.now() >= expires) {
        setState('expired');
        return;
      }

      if (enteredCode === code) {
        setRedirectSeconds(3);
        setState('success');
      } else {
        setTries((current) => { const next = current + 1; if (next >= MAX_OTP_ATTEMPTS) setState('expired'); return next; });
        setDigits(['', '', '', '', '', '']);
        if (tries + 1 < MAX_OTP_ATTEMPTS) setState('error');
      }
    }, reduce ? 300 : 1700);

    return () => window.clearTimeout(timer);
  }, [state, code, expires, digits, reduce]);

  // Success has its own redirect timer. It is independent of OTP validation,
  // so success cannot be overwritten by the input/expiry effects.
  useEffect(() => {
    if (state !== 'success') return;

    const countdown = window.setInterval(() => {
      setRedirectSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    const redirect = window.setTimeout(() => {
      done();
    }, reduce ? 400 : 3200);

    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(redirect);
    };
  }, [state, done, reduce]);

  const resend = () => {
    setCode(makeOTP());
    setDigits(['', '', '', '', '', '']);
    setTries(0);
    setExpires(Date.now() + OTP_TTL);
    setRedirectSeconds(3);
    setState('input');
  };

  const setDigit = (i: number, value: string) => {
    if (state !== 'input' && state !== 'error') return;
    const clean = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
    if (next.every(Boolean)) setState('verifying');
  };

  const paste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    if (state !== 'input' && state !== 'error') return;
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    setDigits(Array.from({ length: 6 }, (_, i) => text[i] || ''));
    refs.current[Math.min(text.length, 6) - 1]?.focus();
    if (text.length === 6) setState('verifying');
  };

  const locked = tries >= MAX_OTP_ATTEMPTS;

  return <Shell onBack={back} variant="verification">
    <div className="verification-card-brand"><div className="verification-shield"><ShieldCheck size={28}/></div><strong>CRISIS<span>MESH</span></strong><small>EMERGENCY RESPONSE SIMULATION</small></div>
    <button className="back-link" onClick={back}><ArrowLeft size={15}/> Back</button>
    <div className="auth-heading"><div className="auth-icon"><ShieldCheck size={21}/></div><div><span className="eyebrow">{role === 'author' ? 'AUTHOR SECURITY VERIFICATION' : 'SECURITY VERIFICATION'}</span><h2>{state === 'success' ? 'Verification successful' : state === 'expired' ? 'Code expired' : 'Verify your identity'}</h2></div></div>
    {state !== 'success' && state !== 'expired' && <p className="auth-copy">Enter the 6-digit verification code generated for this simulation.</p>}
    <AnimatePresence mode="wait">
      {(state === 'input' || state === 'error') && <motion.div key="input" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: .96 }}>
        <div className={`otp-inputs ${state === 'error' ? 'shake' : ''}`}>
          {digits.map((v, i) => <input key={i} ref={e => { refs.current[i] = e; }} value={v} inputMode="numeric" maxLength={1} disabled={locked || seconds <= 0} aria-label={`Verification digit ${i + 1} of 6`} onPaste={paste} onChange={e => setDigit(i, e.target.value)} onKeyDown={e => { if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus(); }} />)}
        </div>
        {state === 'error' && <div className="notice error"><XCircle size={16}/>VERIFICATION FAILED — Invalid verification code. Attempts remaining: {Math.max(0, MAX_OTP_ATTEMPTS - tries)}.</div>}
        <div className="countdown"><span>CODE EXPIRES IN {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</span><i style={{ transform: `scaleX(${seconds / 60})` }} /></div>
        <div className="switch-line">Didn't receive the code? <button onClick={resend}>Resend code</button></div>
        <Demo code={code}/>
      </motion.div>}
      {state === 'verifying' && <motion.div key="verify" className="verify-state" initial={{ opacity: 0, scale: .95 }} animate={{ opacity: 1, scale: 1 }}><div className="orbit"><div className="orbit-core"><ShieldCheck size={22}/></div>{digits.map((x, i) => <b key={i} style={{ transform: `rotate(${i * 60}deg) translateY(-62px) rotate(${-i * 60}deg)` }}>{x}</b>)}</div><h3>Verifying...</h3><p>Validating security credentials</p></motion.div>}
      {state === 'success' && <motion.div key="success" className="success-state" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .45 }}><div className="success-burst"><Sparkles size={16}/><span/><span/><span/><span/></div><motion.div className="success-ring" initial={{ scale: .55, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 14 }}><Check size={55}/></motion.div><div className="success-label"><ShieldCheck size={14}/><span>DEMO VERIFICATION SUCCESSFUL</span></div><h3>{role === 'author' ? 'Identity verified' : 'Identity verified'}</h3><p>{role === 'author' ? 'Coordinator credentials verified for this academic simulation.' : 'Your CrisisMesh demo identity has been verified successfully.'}</p><div className="secure-panel"><div className="secure-panel-icon"><LockKeyhole size={17}/></div><div><strong>DEMO SIMULATION ACCESS</strong><span>This local session can access the CrisisMesh academic simulation interface.</span></div></div><div className="redirect-row"><span>Redirecting to Command Center...</span><b>{redirectSeconds}</b></div><div className="redirect-progress"><i/></div></motion.div>}
      {state === 'expired' && <motion.div key="expired" className="expired-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="expired-icon"><RefreshCw size={24}/></div><div className="success-label"><ShieldCheck size={14}/><span>CODE EXPIRED</span></div><p>This verification code has expired.</p><button className="primary" onClick={resend}><RefreshCw size={16}/> GENERATE NEW CODE</button><Demo code={code}/></motion.div>}
    </AnimatePresence>
  </Shell>;
}
function Demo({ code }: { code: string }) { return <aside className="demo-code"><span>DEMO / SIMULATION</span><small>SIMULATION VERIFICATION CODE</small><strong>{code}</strong></aside>; }

function Dashboard({ role, onHome }: { role: Role; onHome: () => void }) {
  return role === 'author' ? <CommandCenter onHome={onHome} /> : <UserDashboard onHome={onHome} />;
}

function UserDashboard({ onHome }: { onHome: () => void }) {
  const [reportOpen, setReportOpen] = useState(false);
  const [state, setState] = useState<SimulationState | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => { try { setError(''); const data = await simulationRequest<SimulationResponse>({ action: 'STATE' }); setState(data.state ?? null); } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Simulation bridge unavailable.'); } }, []);
  useEffect(() => { refresh(); const id = window.setInterval(refresh, 10000); return () => window.clearInterval(id); }, [refresh]);
  const selectedIncident = state?.incidents.find(i => i.incidentId === selectedIncidentId) ?? null;
  const selectedEvents = selectedIncident ? (state?.eventHistory ?? []).filter(e => e.incidentId === selectedIncident.incidentId).slice(-12) : [];
  const activeIncidents = state?.incidents.filter(i => i.status !== 'CLOSED') ?? [];
  const closedIncidents = state?.incidents.filter(i => i.status === 'CLOSED').slice().reverse() ?? [];
  return <main className="user-dashboard">
    <header className="user-dash-head"><div><span className="eyebrow">SIMULATION ACCESS / USER DASHBOARD</span><h1>Emergency request monitor</h1><p>Academic simulation view. Operational decisions are produced by the C++17 engine.</p></div><div className="user-dash-actions"><button onClick={refresh}><RefreshCw size={14}/> REFRESH STATE</button><button onClick={onHome}>LOG OUT</button></div></header>
    {error && <div className="user-dash-alert" role="alert"><XCircle size={15}/> {error}</div>}
    <section className="user-dash-grid"><article><span>ACTIVE REQUESTS</span><b>{state?.analytics.activeIncidents ?? '—'}</b></article><article><span>RESOLVED</span><b>{state?.analytics.resolvedIncidents ?? '—'}</b></article><article><span>AVAILABLE RESPONDERS</span><b>{state?.analytics.availableResponders ?? '—'}</b></article><article><span>BRIDGE</span><b>{state?.bridge ? 'ONLINE' : 'OFFLINE'}</b></article></section>
    <section className="user-dash-content"><div className="user-panel"><div className="panel-heading"><div><span className="eyebrow">REQUEST INTAKE</span><h2>Report an emergency</h2></div><button className="primary" onClick={() => setReportOpen(true)}><AlertTriangle size={15}/> REPORT EMERGENCY</button></div><p>Submit a deterministic simulation incident. Queueing, priority, responder selection and routing remain authoritative in C++.</p></div>
      <div className="user-panel"><div className="panel-heading"><div><span className="eyebrow">CURRENT STATE / C++ SESSION</span><h2>Active requests</h2></div></div>{activeIncidents.map(i => <button className={`user-incident user-incident-button ${selectedIncidentId === i.incidentId ? 'selected' : ''}`} key={i.incidentId} onClick={() => setSelectedIncidentId(i.incidentId)}><div><b>{i.incidentId}</b><span>{i.type} · {i.locationId}</span></div><strong>{i.status}</strong><small>Priority {i.priorityScore} · Responder {i.assignedResponderId || 'WAITING FOR RESOURCE'}</small></button>)}{!activeIncidents.length && <div className="empty-state">NO ACTIVE REQUESTS · REPORT A NEW EMERGENCY TO BEGIN</div>}</div>
      <div className="user-panel"><div className="panel-heading"><div><span className="eyebrow">REQUEST HISTORY / C++ SESSION</span><h2>Resolved records</h2></div></div>{closedIncidents.map(i => <button className={`user-incident user-incident-button ${selectedIncidentId === i.incidentId ? 'selected' : ''}`} key={i.incidentId} onClick={() => setSelectedIncidentId(i.incidentId)}><div><b>{i.incidentId}</b><span>{i.type} · {i.locationId}</span></div><strong>RESOLVED / CLOSED</strong><small>Priority {i.priorityScore}</small></button>)}{!closedIncidents.length && <div className="empty-state">NO HISTORY IN CURRENT ENGINE SESSION</div>}</div>
      {selectedIncident && <section className="user-panel user-incident-detail" aria-live="polite"><div className="panel-heading"><div><span className="eyebrow">INCIDENT TRACKING / C++ STATE</span><h2>{selectedIncident.incidentId}</h2></div><button onClick={() => setSelectedIncidentId(null)} aria-label="Close incident details">CLOSE</button></div><div className="user-detail-grid"><div><span>STATUS</span><b>{selectedIncident.status}</b></div><div><span>PRIORITY</span><b>{selectedIncident.priorityScore}</b></div><div><span>LOCATION</span><b>{selectedIncident.locationId}</b></div><div><span>RESPONDER</span><b>{selectedIncident.assignedResponderId || 'WAITING FOR RESOURCE'}</b></div><div><span>SEVERITY / URGENCY</span><b>{selectedIncident.severity} / {selectedIncident.urgency}</b></div><div><span>VICTIMS</span><b>{selectedIncident.victimCount}</b></div></div><div className="user-timeline"><span className="eyebrow">C++ EVENT TIMELINE</span>{selectedEvents.length ? selectedEvents.map(e => <div key={`${e.step}-${e.type}`}><i>{String(e.step).padStart(2,'0')}</i><div><b>{e.type.replace(/_/g,' ')}</b><small>{e.message}</small></div></div>) : <div className="empty-state">NO EVENTS RECORDED FOR THIS INCIDENT.</div>}</div></section>}
    </section>
    {reportOpen && <EmergencyReport onClose={() => setReportOpen(false)} onSubmitted={payload => { if (payload.state) setState(payload.state); }} />}
  </main>;
}

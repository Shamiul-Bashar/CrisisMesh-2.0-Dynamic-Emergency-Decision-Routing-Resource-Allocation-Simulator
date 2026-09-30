import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Check, ChevronRight, CircleUserRound, Command, Eye, EyeOff, LockKeyhole, Mail, MapPinned, Radio, RefreshCw, ShieldCheck, Sparkles, UserRound, Users, XCircle } from 'lucide-react';
import './style.css';
import CommandCenter from './features/command-center/CommandCenter';
import CitizenDashboard from './features/citizen/CitizenDashboard';
import {
  authenticateUser,
  hashPassword,
  normalizeEmail,
  normalizePhone,
  normalizeUsername,
  readAuthorPassword,
  readSession,
  readUsers,
  updateUserPassword,
  writeAuthorPasswordVerified,
  writeSessionVerified,
  writeUsersVerified,
  type Role,
  type StoredUser,
} from './core/auth/credentials';

type Screen = 'home' | 'login' | 'register' | 'forgot' | 'otp' | 'dashboard';
type OTPState = 'input' | 'verifying' | 'success' | 'error' | 'expired';

const OTP_TTL = 60_000;
const AUTHOR = { username: 'admin', password: 'CrisisMesh@2026' };
const AUTHOR_RECOVERY_EMAIL = 'crisismeshauthor121318@gmail.com';

const makeOTP = () => { const bytes = new Uint32Array(1); crypto.getRandomValues(bytes); return String(100000 + (bytes[0] % 900000)); };
const getAuthorPassword = () => {
  try {
    return readAuthorPassword(localStorage, AUTHOR.password);
  } catch {
    return AUTHOR.password;
  }
};
const setAuthorPassword = (password: string) => {
  writeAuthorPasswordVerified(localStorage, password);
};
const maskPhone = (value: string) => {
  const digits = normalizePhone(value);
  if (digits.length <= 4) return `${digits.slice(0, 2)}${'*'.repeat(Math.max(2, digits.length - 2))}`;
  return `${digits.slice(0, 2)}${'*'.repeat(Math.max(3, digits.length - 4))}${digits.slice(-2)}`;
};
const maskEmail = (value: string) => {
  const normalized = normalizeEmail(value);
  if (!normalized || !normalized.includes('@')) return '********';
  const [localPart, domainPart] = normalized.split('@');
  if (!localPart || !domainPart) return '********';
  const visibleStart = localPart.slice(0, 2);
  const hiddenLength = Math.max(4, localPart.length - 4);
  const visibleEnd = localPart.slice(-2);
  return `${visibleStart}${'*'.repeat(hiddenLength)}${visibleEnd}@${domainPart}`;
};
const getPasswordStrength = (password: string) => {
  if (!password) return { label: '', score: 0, width: 0, color: 'transparent' };
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const map = [
    { label: 'Very weak', color: '#ff5d6a', width: 25 },
    { label: 'Weak', color: '#ff9a4d', width: 50 },
    { label: 'Moderate', color: '#f4c24d', width: 75 },
    { label: 'Strong', color: '#48d4a5', width: 100 },
  ];
  const safeIndex = Math.min(score, map.length) - 1;
  const finalIndex = score > 0 ? safeIndex : 0;
  const active = map[Math.min(finalIndex, map.length - 1)];
  return {
    label: password.length < 8 ? 'Needs 8+ characters' : active.label,
    score,
    width: Math.max(12, active.width),
    color: active.color,
  };
};

const hashText = hashPassword;

function getUsers(): StoredUser[] {
  return readUsers(localStorage);
}
function saveUsers(users: StoredUser[]) { writeUsersVerified(localStorage, users); }

export default function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    return readSession(localStorage) ? 'dashboard' : 'home';
  });
  const [role, setRole] = useState<Role>(() => {
    return readSession(localStorage)?.role ?? 'user';
  });
  const [authNotice, setAuthNotice] = useState('');
  const [pendingUser, setPendingUser] = useState<StoredUser | null>(null);
  const [pendingSessionUserId, setPendingSessionUserId] = useState<string | null>(null);

  const goHome = () => { localStorage.removeItem('cm-session'); setAuthNotice(''); setScreen('home'); };
  const startLogin = (nextRole: Role) => { setRole(nextRole); setAuthNotice(''); setScreen('login'); };

  const completeOTP = async () => {
    const sessionUserId = role === 'author' ? 'author' : pendingSessionUserId;
    if (!sessionUserId) {
      setAuthNotice('Unable to establish the authenticated user identity. Please sign in again.');
      setScreen('login');
      return;
    }
    if (pendingUser) {
      const users = getUsers();
      saveUsers([...users.filter((u) => u.id !== pendingUser.id), pendingUser]);
      setPendingUser(null);
    }
    writeSessionVerified(localStorage, role, sessionUserId);
    setPendingSessionUserId(null);
    setScreen('dashboard');
  };

  return (
    <AnimatePresence mode="wait">
      {screen === 'home' && <Home key="home" onLogin={startLogin} />}
      {screen === 'login' && <Login key="login" role={role} onBack={goHome} onRegister={() => { setAuthNotice(''); setScreen('register'); }} onContinue={(userId) => { setPendingSessionUserId(userId); setScreen('otp'); }} onForgot={() => { setAuthNotice(''); setScreen('forgot'); }} notice={authNotice} setNotice={setAuthNotice} />}
      {screen === 'forgot' && <ForgotPassword key="forgot" role={role} onBack={() => setScreen('login')} onSuccess={() => { setAuthNotice(''); setScreen('login'); }} />}
      {screen === 'register' && <Register key="register" onBack={() => setScreen('login')} onCreated={(user) => { setPendingUser(user); setPendingSessionUserId(user.id); setRole('user'); setScreen('otp'); }} />}
      {screen === 'otp' && <OTP key="otp" role={role} back={() => setScreen(role === 'user' && pendingUser ? 'register' : 'login')} done={completeOTP} />}
      {screen === 'dashboard' && <Dashboard key="dashboard" role={role} onHome={goHome} />}
    </AnimatePresence>
  );
}

function Shell({ children, eyebrow = 'CRISISMESH / AUTHENTICATION', onBack, variant = 'default' }: { children: React.ReactNode; eyebrow?: string; onBack?: () => void; variant?: 'default' | 'verification' }) {
  return <main className={`auth-page ${variant === 'verification' ? 'verification-page' : ''}`}><AmbientNetwork verification={variant === 'verification'} /><header className="brandbar"><button className="brand" onClick={() => onBack?.()}><span className="brand-mark"><Radio size={17} /></span><span>CRISISMESH</span></button><div className="brand-status"><i /> C++ SIMULATION DEVELOPMENT BRIDGE <b>DEVELOPMENT MODE</b></div></header><div className="auth-wrap"><motion.div className="auth-card" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: .45 }}>{children}</motion.div></div><footer className="auth-footer"><span>C++17 EMERGENCY DECISION ENGINE</span><span>ACADEMIC SIMULATION / LOCAL ACCESS</span></footer></main>;
}

function AmbientNetwork({ verification = false }: { verification?: boolean }) {
  const points = useMemo(() => Array.from({ length: 18 }, (_, i) => ({ left: `${8 + ((i * 37) % 86)}%`, top: `${12 + ((i * 53) % 76)}%`, delay: `${(i % 5) * .7}s` })), []);
  return <div className={`ambient ${verification ? 'ambient-verification' : ''}`} aria-hidden="true"><div className="ambient-grid"/><div className="ambient-glow"/>{verification && <><div className="cityline cityline-a"/><div className="cityline cityline-b"/><div className="network-arc arc-a"/><div className="network-arc arc-b"/><div className="signal-marker marker-med">+</div><div className="signal-marker marker-alert">!</div><div className="signal-marker marker-core">⌁</div></>}{points.map((p, i) => <span key={i} className="node" style={p} />)}</div>;
}

function Home({ onLogin }: { onLogin: (role: Role) => void }) {
  return <main className="home-page"><AmbientNetwork /><nav className="home-nav"><div className="brand"><span className="brand-mark"><Radio size={18} /></span><span>CRISISMESH</span></div><div className="nav-links" aria-label="Primary navigation"><span>Platform</span><span>Simulation</span><span>Response</span><span>Security</span></div><div className="nav-meta"><span className="status-dot"/> CITY ENGINE <em>LIVE</em></div></nav><section className="hero"><motion.div className="hero-copy-panel" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}><div className="eyebrow"><span>01</span> EMERGENCY RESPONSE NETWORK</div><h1 className="hero-main-headline"><span>Real-time emergency coordination.</span><span>Built for precision under pressure.</span></h1><p className="hero-copy">A high-fidelity emergency response simulator that models city-scale coordination, routing, and resource allocation in real time.</p><div className="hero-actions"><button className="role-card author" onClick={() => onLogin('author')}><span className="role-icon"><ShieldCheck size={21} /></span><span><b>Login as Author</b><small>Coordinator access and verification</small></span><ChevronRight size={18} /></button><button className="role-card" onClick={() => onLogin('user')}><span className="role-icon"><UserRound size={21} /></span><span><b>Login as User</b><small>Citizen access and incident workflow</small></span><ChevronRight size={18} /></button></div><div className="hero-trust"><div><ShieldCheck size={15}/> Deterministic routing</div><div><Check size={15}/> Simulator ready</div><div><Radio size={15}/> Live engine status</div></div></motion.div><motion.aside className="hero-panel" initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: .2, duration: .55 }}><div className="panel-top"><span>NETWORK OVERVIEW</span><span className="panel-status"><i /> SIMULATOR READY</span></div><div className="network-visual"><div className="ring ring-a"/><div className="ring ring-b"/><div className="core"><Command size={20}/></div>{Array.from({length: 9}, (_, i) => <span key={i} className={`map-node n${i}`}><i/></span>)}<svg viewBox="0 0 420 330" preserveAspectRatio="none"><path d="M50 250 L120 120 L210 185 L300 80 L370 230 M120 120 L210 185 L360 115 M50 250 L210 185 L370 230"/><path d="M120 120 L300 80"/></svg></div><div className="metrics"><div><span>NETWORK</span><b>MODELED</b></div><div><span>ACCESS</span><b>SIMULATED</b></div><div><span>ENGINE</span><b>C++17</b></div></div></motion.aside></section><div className="home-bottom"><span>GRAPH / ROUTING / PRIORITY / RESOURCES</span><span>C++ DECISION ENGINE / REACT OPERATIONS</span></div></main>;
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

function Login({ role, onBack, onRegister, onContinue, onForgot, notice, setNotice }: { role: Role; onBack: () => void; onRegister: () => void; onContinue: (userId: string) => void; onForgot: () => void; notice: string; setNotice: (v: string) => void }) {
  const [identity, setIdentity] = useState(role === 'author' ? 'admin' : '');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity || !password) return setNotice('Please complete all required fields.');
    if (role === 'author') {
      if (normalizeUsername(identity) !== AUTHOR.username || password !== getAuthorPassword()) return setNotice('Invalid coordinator credentials.');
      setNotice(''); onContinue('author');
    } else {
      const users = getUsers();
      const u = await authenticateUser(localStorage, identity, password);
      if (!u) return setNotice('Invalid username/email or password.');
      const updatedUsers: StoredUser[] = users.map((user) => user.id === u.id ? { ...user, lastLogin: Date.now(), accountStatus: 'Active' as const } : user);
      saveUsers(updatedUsers);
      setNotice(''); onContinue(u.id);
    }
  };
  return <Shell onBack={onBack}><button className="back-link" onClick={onBack}><ArrowLeft size={15}/> Back to home</button><div className="auth-heading"><div className="auth-icon"><LockKeyhole size={21}/></div><div><span className="eyebrow">{role === 'author' ? 'COORDINATOR ACCESS' : 'CITIZEN ACCESS'}</span><TypewriterHeading phrases={role === 'author' ? ['INITIALIZING SECURE CONNECTION...', 'VERIFYING COORDINATOR ACCESS...', 'AUTHENTICATING NODE...'] : ['AUTHENTICATING NODE...', 'SECURE SESSION ONLINE...', 'WELCOME BACK...']} /></div></div><p className="auth-copy">{role === 'author' ? 'Authenticate the single simulation coordinator before security verification.' : 'Sign in to your CrisisMesh simulation account.'}</p>{notice && <div className="notice error"><XCircle size={16}/>{notice}</div>}<form onSubmit={submit} className="form"><label>Username or email<input autoComplete="username" value={identity} onChange={e => setIdentity(e.target.value)} placeholder={role === 'author' ? 'admin' : 'username or email'} /></label><label>Password<div className="password-wrap"><input autoComplete="current-password" type={show ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" /><button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label><div className="forgot-password-row"><button type="button" className="link-button" onClick={onForgot}>Forgot Password?</button></div><button className="primary" type="submit">CONTINUE TO SECURITY <ChevronRight size={16}/></button></form>{role === 'user' && <div className="switch-line">New to CrisisMesh? <button onClick={onRegister}>Create new user ID</button></div>}<div className="demo-note"><span>ACCESS INFORMATION</span>{role === 'author' ? <b>Seeded coordinator account: admin</b> : <small>Register an account to continue.</small>}</div></Shell>;
}

function ForgotPassword({
  role,
  onBack,
  onSuccess,
}: {
  role: Role;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [step, setStep] =
    useState<'identity' | 'verify' | 'reset' | 'success'>('identity');

  const [identity, setIdentity] = useState('');
  const [notice, setNotice] = useState('');

  /*
   * verificationCode is kept ONLY for the local User recovery demo.
   * Author OTP is never stored in React.
   */
  const [verificationCode, setVerificationCode] = useState('');

  const [digits, setDigits] =
    useState(['', '', '', '', '', '']);

  const [expiresAt, setExpiresAt] =
    useState<number | null>(null);

  const [countdown, setCountdown] =
    useState(60);

  const [userMatch, setUserMatch] =
    useState<StoredUser | null>(null);

  const [newPassword, setNewPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [isSendingCode, setIsSendingCode] =
    useState(false);

  const [isVerifyingCode, setIsVerifyingCode] =
    useState(false);

  const refs =
    useRef<(HTMLInputElement | null)[]>([]);

  const strength = useMemo(
    () => getPasswordStrength(newPassword),
    [newPassword]
  );


  /* =========================================================
     CLEAR RECOVERY STATE
     ========================================================= */

  const clearRecoveryState = () => {
    setIdentity('');
    setNotice('');
    setVerificationCode('');

    setDigits([
      '',
      '',
      '',
      '',
      '',
      '',
    ]);

    setExpiresAt(null);
    setCountdown(60);
    setUserMatch(null);

    setNewPassword('');
    setConfirmPassword('');

    setShowNewPassword(false);
    setShowConfirmPassword(false);

    setIsSubmitting(false);
    setIsSendingCode(false);
    setIsVerifyingCode(false);
  };


  /* =========================================================
     LOCAL USER OTP
     ========================================================= */

  const generateLocalUserCode = () => {
    const nextCode = makeOTP();

    setVerificationCode(nextCode);

    setDigits([
      '',
      '',
      '',
      '',
      '',
      '',
    ]);

    setExpiresAt(
      Date.now() + OTP_TTL
    );

    setCountdown(60);

    setNotice(
      'Verification code generated. Use the code below to continue.'
    );
  };


  /* =========================================================
     SEND REAL AUTHOR EMAIL OTP
     ========================================================= */

  const sendAuthorOtp = async (
    email: string
  ) => {
    setIsSendingCode(true);
    setNotice('');

    try {
      const response = await fetch(
        '/api/auth/send-author-otp',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',
          },

          body: JSON.stringify({
            email:
              normalizeEmail(email),
          }),
        }
      );

      const data = await response.json() as {
        ok?: boolean;
        message?: string;
        error?: string;
        expiresInSeconds?: number;
        secondsRemaining?: number;
      };

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
            'Unable to send verification code.'
        );
      }

      setVerificationCode('');

      setDigits([
        '',
        '',
        '',
        '',
        '',
        '',
      ]);

      const duration =
        data.expiresInSeconds ?? 60;

      setExpiresAt(
        Date.now() +
          duration * 1000
      );

      setCountdown(duration);

      setNotice('');

      setStep('verify');

      window.setTimeout(() => {
        refs.current[0]?.focus();
      }, 50);

    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Unable to send verification code.'
      );

    } finally {
      setIsSendingCode(false);
    }
  };


  /* =========================================================
     RESEND / GENERATE CODE
     ========================================================= */

  const resetCode = async () => {
    setNotice('');

    if (role === 'author') {
      if (
        !identity ||
        normalizeEmail(identity) !==
          normalizeEmail(
            AUTHOR_RECOVERY_EMAIL
          )
      ) {
        setNotice(
          'Unable to verify the recovery email.'
        );

        return;
      }

      await sendAuthorOtp(identity);
      return;
    }

    generateLocalUserCode();
  };


  /* =========================================================
     BACK
     ========================================================= */

  const handleBack = () => {
    clearRecoveryState();
    setStep('identity');
    onBack();
  };


  /* =========================================================
     COUNTDOWN
     ========================================================= */

  useEffect(() => {
    if (
      step !== 'verify' ||
      !expiresAt
    ) {
      return;
    }

    const tick = () => {
      const remaining =
        Math.max(
          0,
          Math.ceil(
            (
              expiresAt -
              Date.now()
            ) / 1000
          )
        );

      setCountdown(remaining);

      if (remaining <= 0) {
        setNotice(
          role === 'author'
            ? 'Verification code has expired. Request a new code.'
            : 'Verification code has expired. Please generate a new code.'
        );
      }
    };

    tick();

    const id =
      window.setInterval(
        tick,
        1000
      );

    return () =>
      window.clearInterval(id);

  }, [
    step,
    expiresAt,
    role,
  ]);


  /* =========================================================
     STEP 1 — VERIFY IDENTITY
     ========================================================= */

  const submitIdentity = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setNotice('');

    /* ================= AUTHOR ================= */

    if (role === 'author') {
      if (
        !identity ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          identity
        )
      ) {
        setNotice(
          'Please enter a valid recovery email.'
        );

        return;
      }

      if (
        normalizeEmail(identity) !==
        normalizeEmail(
          AUTHOR_RECOVERY_EMAIL
        )
      ) {
        setNotice(
          'Unable to verify the account information. Please check your details and try again.'
        );

        return;
      }

      setUserMatch(null);

      /*
       * Real Gmail OTP is requested here.
       */
      await sendAuthorOtp(identity);

      return;
    }


    /* ================= USER ================= */

    const normalizedPhone =
      normalizePhone(identity);

    if (
      !normalizedPhone ||
      normalizedPhone.length < 8
    ) {
      setNotice(
        'Please enter a valid phone number associated with your account.'
      );

      return;
    }

    const users = getUsers();

    const match =
      users.find(
        (user) =>
          normalizePhone(
            user.phone
          ) === normalizedPhone
      );

    if (!match) {
      setNotice(
        'Unable to verify the account information. Please check your details and try again.'
      );

      return;
    }

    setUserMatch(match);

    generateLocalUserCode();

    setStep('verify');

    window.setTimeout(() => {
      refs.current[0]?.focus();
    }, 50);
  };


  /* =========================================================
     STEP 2 — VERIFY OTP
     ========================================================= */

  const submitVerification = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setNotice('');

    if (
      !expiresAt ||
      Date.now() >= expiresAt
    ) {
      setNotice(
        'Verification code has expired. Request a new code.'
      );

      return;
    }

    const enteredCode =
      digits.join('');

    if (
      enteredCode.length !== 6
    ) {
      setNotice(
        'Please enter the complete 6-digit verification code.'
      );

      return;
    }


    /* ================= AUTHOR ================= */

    if (role === 'author') {
      setIsVerifyingCode(true);

      try {
        const response = await fetch(
          '/api/auth/verify-author-otp',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json',
            },

            body: JSON.stringify({
              email:
                normalizeEmail(
                  identity
                ),

              otp: enteredCode,
            }),
          }
        );

        const data =
          await response.json() as {
            ok?: boolean;
            verified?: boolean;
            message?: string;
            error?: string;
            attemptsRemaining?: number;
          };

        if (
          !response.ok ||
          !data.ok ||
          !data.verified
        ) {
          throw new Error(
            data.error ||
              'Invalid verification code.'
          );
        }

        setNotice('');
        setDigits([
          '',
          '',
          '',
          '',
          '',
          '',
        ]);

        setStep('reset');

      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : 'Unable to verify the code.'
        );

        setDigits([
          '',
          '',
          '',
          '',
          '',
          '',
        ]);

        window.setTimeout(() => {
          refs.current[0]?.focus();
        }, 50);

      } finally {
        setIsVerifyingCode(false);
      }

      return;
    }


    /* ================= USER ================= */

    if (
      enteredCode !==
      verificationCode
    ) {
      setNotice(
        'Invalid verification code. Please try again.'
      );

      setDigits([
        '',
        '',
        '',
        '',
        '',
        '',
      ]);

      return;
    }

    setNotice('');
    setStep('reset');
  };


  /* =========================================================
     STEP 3 — RESET PASSWORD
     ========================================================= */

  const submitReset = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setNotice('');

    if (!newPassword.trim()) {
      setNotice(
        'Please enter a new password.'
      );

      return;
    }

    if (newPassword.length < 8) {
      setNotice(
        'Password must contain at least 8 characters.'
      );

      return;
    }

    if (!confirmPassword.trim()) {
      setNotice(
        'Please confirm your new password.'
      );

      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setNotice(
        'Passwords do not match.'
      );

      return;
    }

    setIsSubmitting(true);

    try {
      if (role === 'author') {
        setAuthorPassword(
          newPassword
        );

      } else if (userMatch) {
        await updateUserPassword(localStorage, userMatch.id, newPassword);
      } else {
        throw new Error('The intended user account could not be identified.');
      }

      setStep('success');

    } catch {
      setNotice(
        'We were unable to update your password. Please try again.'
      );

    } finally {
      setIsSubmitting(false);
    }
  };


  /* =========================================================
     OTP INPUT
     ========================================================= */

  const handleDigitChange = (
    index: number,
    value: string
  ) => {
    const sanitized =
      value
        .replace(/\D/g, '')
        .slice(-1);

    const next = [...digits];

    next[index] =
      sanitized;

    setDigits(next);

    if (
      sanitized &&
      index < 5
    ) {
      refs.current[
        index + 1
      ]?.focus();
    }
  };


  /* =========================================================
     UI
     ========================================================= */

  return (
    <Shell
      onBack={handleBack}
      variant="verification"
    >

      <button
        className="back-link"
        onClick={handleBack}
      >
        <ArrowLeft size={15}/>
        Back to login
      </button>


      <div className="verification-card-brand">

        <div className="verification-shield">
          <ShieldCheck size={28}/>
        </div>

        <strong>
          CRISIS
          <span>MESH</span>
        </strong>

        <small>
          EMERGENCY RESPONSE SIMULATION
        </small>

      </div>


      <div className="auth-heading">

        <div className="auth-icon">
          <ShieldCheck size={21}/>
        </div>

        <div>

          <span className="eyebrow">
            {role === 'author'
              ? 'ACCOUNT RECOVERY'
              : 'PASSWORD RECOVERY'}
          </span>

          <h2>
            {
              step === 'identity'
                ? 'Forgot Password?'

                : step === 'verify'
                  ? 'Verify Your Identity'

                  : step === 'reset'
                    ? 'Reset Your Password'

                    : 'Password Updated'
            }
          </h2>

        </div>

      </div>


      {notice && (
        <div className="notice error">
          <XCircle size={16}/>
          {notice}
        </div>
      )}


      {/* ===================================================
          IDENTITY
          =================================================== */}

      {step === 'identity' && (

        <form
          onSubmit={submitIdentity}
          className="form"
        >

          <p className="auth-copy">

            {role === 'author'
              ? 'Enter your registered recovery email. A 6-digit verification code will be sent to your email.'
              : 'Verify your registered phone number to continue.'}

          </p>


          {role === 'author' && (

            <div className="masked-identity-box">

              <span>
                Registered recovery email
              </span>

              <strong>
                {maskEmail(
                  AUTHOR_RECOVERY_EMAIL
                )}
              </strong>

            </div>

          )}


          <label>

            {role === 'author'
              ? 'Recovery Email'
              : 'Registered Phone Number'}

            <input
              value={identity}

              onChange={(e) =>
                setIdentity(
                  e.target.value
                )
              }

              placeholder={
                role === 'author'
                  ? 'Enter recovery email address'
                  : 'Enter registered phone number'
              }

              autoComplete={
                role === 'author'
                  ? 'email'
                  : 'tel'
              }

              disabled={
                isSendingCode
              }
            />

          </label>


          <button
            className="primary"
            type="submit"
            disabled={isSendingCode}
          >

            {isSendingCode
              ? 'SENDING CODE...'
              : 'CONTINUE'}

            {!isSendingCode && (
              <ChevronRight
                size={16}
              />
            )}

          </button>

        </form>
      )}


      {/* ===================================================
          VERIFY OTP
          =================================================== */}

      {step === 'verify' && (

        <form
          onSubmit={
            submitVerification
          }
          className="form"
        >

          <p className="auth-copy">

            {role === 'author'
              ? `Enter the 6-digit verification code sent to ${maskEmail(AUTHOR_RECOVERY_EMAIL)}.`
              : 'Enter the verification code generated for your account.'}

          </p>


          {/* USER DEMO OTP ONLY */}

          {role === 'user' && (

            <div className="verification-code-box">

              <span>
                Verification Code
              </span>

              <strong>
                {
                  verificationCode ||
                  '••••••'
                }
              </strong>

            </div>

          )}


          {/* AUTHOR EMAIL STATUS */}

          {role === 'author' && (

            <div className="masked-identity-box">

              <span>
                Verification code sent to
              </span>

              <strong>
                {maskEmail(
                  AUTHOR_RECOVERY_EMAIL
                )}
              </strong>

            </div>

          )}


          <div className="otp-inputs recovery-otp">

            {digits.map(
              (digit, index) => (

                <input
                  key={index}

                  aria-label={
                    `Recovery code digit ${
                      index + 1
                    }`
                  }

                  value={digit}

                  inputMode="numeric"

                  autoComplete={
                    index === 0
                      ? 'one-time-code'
                      : 'off'
                  }

                  maxLength={1}

                  disabled={
                    isVerifyingCode
                  }

                  onChange={(e) =>
                    handleDigitChange(
                      index,
                      e.target.value
                    )
                  }

                  onKeyDown={(e) => {
                    if (
                      e.key ===
                        'Backspace' &&
                      !digits[index] &&
                      index > 0
                    ) {
                      refs.current[
                        index - 1
                      ]?.focus();
                    }
                  }}

                  ref={(el) => {
                    refs.current[
                      index
                    ] = el;
                  }}
                />

              )
            )}

          </div>


          <div className="countdown">

            <span>

              {countdown > 0
                ? `Code expires in ${countdown}s`
                : 'Code expired'}

            </span>

            <i
              style={{
                transform:
                  `scaleX(${countdown / 60})`,
              }}
            />

          </div>


          <button
            className="primary"
            type="submit"

            disabled={
              countdown <= 0 ||
              isVerifyingCode
            }
          >

            {isVerifyingCode
              ? 'VERIFYING...'
              : 'VERIFY CODE'}

            {!isVerifyingCode && (
              <ChevronRight
                size={16}
              />
            )}

          </button>


          <div className="switch-line">

            <button
              type="button"

              onClick={() => {
                void resetCode();
              }}

              disabled={
                countdown > 0 ||
                isSendingCode
              }
            >

              {isSendingCode
                ? 'Sending...'

                : countdown > 0
                  ? `Resend available in ${countdown}s`

                  : role === 'author'
                    ? 'Resend verification code'

                    : 'Generate new code'}

            </button>

          </div>

        </form>
      )}


      {/* ===================================================
          RESET PASSWORD
          =================================================== */}

      {step === 'reset' && (

        <form
          onSubmit={submitReset}
          className="form"
        >

          <p className="auth-copy">

            Create a secure password for your{' '}

            {role === 'author'
              ? 'coordinator account'
              : 'user account'}.

          </p>


          <label>

            New Password

            <div className="password-wrap">

              <input
                type={
                  showNewPassword
                    ? 'text'
                    : 'password'
                }

                value={newPassword}

                onChange={(e) =>
                  setNewPassword(
                    e.target.value
                  )
                }

                placeholder="Enter new password"
              />

              <button
                type="button"

                onClick={() =>
                  setShowNewPassword(
                    (value) =>
                      !value
                  )
                }

                aria-label={
                  showNewPassword
                    ? 'Hide new password'
                    : 'Show new password'
                }
              >

                {showNewPassword
                  ? <EyeOff size={16}/>
                  : <Eye size={16}/>}

              </button>

            </div>

          </label>


          <div className="strength-indicator">

            <span>
              Password strength
            </span>

            <div className="strength-track">

              <i
                style={{
                  width:
                    `${strength.width}%`,

                  background:
                    strength.color,
                }}
              />

            </div>

            <b
              style={{
                color:
                  strength.color,
              }}
            >
              {
                strength.label ||
                'Add a password'
              }
            </b>

          </div>


          <label>

            Confirm New Password

            <div className="password-wrap">

              <input
                type={
                  showConfirmPassword
                    ? 'text'
                    : 'password'
                }

                value={
                  confirmPassword
                }

                onChange={(e) =>
                  setConfirmPassword(
                    e.target.value
                  )
                }

                placeholder="Confirm new password"
              />

              <button
                type="button"

                onClick={() =>
                  setShowConfirmPassword(
                    (value) =>
                      !value
                  )
                }

                aria-label={
                  showConfirmPassword
                    ? 'Hide password confirmation'
                    : 'Show password confirmation'
                }
              >

                {showConfirmPassword
                  ? <EyeOff size={16}/>
                  : <Eye size={16}/>}

              </button>

            </div>

          </label>


          <button
            className="primary"
            type="submit"
            disabled={isSubmitting}
          >

            {isSubmitting
              ? 'UPDATING PASSWORD...'
              : 'RESET PASSWORD'}

            {!isSubmitting && (
              <ChevronRight
                size={16}
              />
            )}

          </button>

        </form>
      )}


      {/* ===================================================
          SUCCESS
          =================================================== */}

      {step === 'success' && (

        <div className="success-state recovery-success">

          <div className="success-ring">
            <Check size={42}/>
          </div>

          <div className="success-label">

            <ShieldCheck
              size={14}
            />

            <span>
              PASSWORD RESET SUCCESSFUL
            </span>

          </div>

          <h3>
            Password updated
          </h3>

          <p>
            Your password has been updated.
            You can now sign in with your new password.
          </p>

          <button
            className="primary"
            onClick={onSuccess}
          >

            BACK TO LOGIN
            <ChevronRight size={16}/>

          </button>

        </div>
      )}

    </Shell>
  );
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
    const user: StoredUser = { id: crypto.randomUUID(), name: f.name.trim(), username: f.username.trim(), phone: normalizePhone(f.phone), email: normalizeEmail(f.email), passwordHash: await hashText(f.password), createdAt: Date.now(), lastLogin: null, accountStatus: 'Active', role: 'user' };
    onCreated(user);
  };
  return <Shell onBack={onBack}><button className="back-link" onClick={onBack}><ArrowLeft size={15}/> Back to user login</button><div className="auth-heading"><div className="auth-icon"><Users size={21}/></div><div><span className="eyebrow">USER REGISTRATION</span><h2>Create your user ID</h2></div></div><p className="auth-copy">Create a secure identity to submit and track emergency requests inside the simulation.</p>{error && <div className="notice error"><XCircle size={16}/>{error}</div>}<form onSubmit={submit} className="form register-form"><label>Full name<input value={f.name} onChange={e => update('name', e.target.value)} placeholder="Your full name" /></label><div className="two-col"><label>Username<input value={f.username} onChange={e => update('username', e.target.value)} placeholder="Choose a username" /></label><label>Phone<input value={f.phone} onChange={e => update('phone', e.target.value)} placeholder="01XXXXXXXXX" /></label></div><label>Email<input type="email" value={f.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" /></label><div className="two-col"><label>Password<div className="password-wrap"><input type={show ? 'text' : 'password'} value={f.password} onChange={e => update('password', e.target.value)} placeholder="Min. 8 characters" /><button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label><label>Confirm password<input type={show ? 'text' : 'password'} value={f.confirm} onChange={e => update('confirm', e.target.value)} placeholder="Repeat password" /></label></div><button className="primary" type="submit">CONTINUE TO VERIFICATION <ChevronRight size={16}/></button></form></Shell>;
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
      {state === 'success' && <motion.div key="success" className="success-state" initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .45 }}><div className="success-burst"><Sparkles size={16}/><span/><span/><span/><span/></div><motion.div className="success-ring" initial={{ scale: .55, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 14 }}><Check size={55}/></motion.div><div className="success-label"><ShieldCheck size={14}/><span>VERIFICATION SUCCESSFUL</span></div><h3>{role === 'author' ? 'Identity verified' : 'Identity verified'}</h3><p>{role === 'author' ? 'Coordinator credentials verified for this academic simulation.' : 'Your CrisisMesh identity has been verified successfully.'}</p><div className="secure-panel"><div className="secure-panel-icon"><LockKeyhole size={17}/></div><div><strong>SIMULATION ACCESS</strong><span>This local session can access the CrisisMesh academic simulation interface.</span></div></div><div className="redirect-row"><span>Redirecting to Command Center...</span><b>{redirectSeconds}</b></div><div className="redirect-progress"><i/></div></motion.div>}
      {state === 'expired' && <motion.div key="expired" className="expired-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><div className="expired-icon"><RefreshCw size={24}/></div><div className="success-label"><ShieldCheck size={14}/><span>CODE EXPIRED</span></div><p>This verification code has expired.</p><button className="primary" onClick={resend}><RefreshCw size={16}/> GENERATE NEW CODE</button><Demo code={code}/></motion.div>}
    </AnimatePresence>
  </Shell>;
}
function Demo({ code }: { code: string }) { return <aside className="demo-code"><span>ACCESS CODE</span><small>SIMULATION VERIFICATION CODE</small><strong>{code}</strong></aside>; }

function Dashboard({ role, onHome }: { role: Role; onHome: () => void }) {
  return role === 'author' ? <CommandCenter onHome={onHome} /> : <CitizenDashboard onHome={onHome} />;
}

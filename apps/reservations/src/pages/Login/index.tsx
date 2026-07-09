import React, { useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Building2, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import type { AuthUser, AuthStep } from '../../store/authStore';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const APP_VERSION = '1.0.0';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// LoginPage — fora do AppLayout (sem sidebar, sem topbar).
// Usa CSS vars do design system existente: --color-*, --radius-*.
//
// Arquitetura interna (F5.1):
//   AuthStep union → renderStep() → renderCredentials()
//   transitionTo()  → preparada pra MFA e forgot-password sem refatoração.
//
// Design:
//   - Ícone Building2 (lucide) no container da marca
//   - Título em serif — contraste intencional com o form sans-serif
//   - "Esqueceu sua senha?" desabilitado até F5.x
//   - Erro LGPD-safe: nunca revela qual campo está errado
//   - Estado de loading com spinner
export default function LoginPage(): JSX.Element {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore(s => s.setAuth);

  const [step, setStep] = useState<AuthStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';

  // Transição entre steps — exposta pra renderXxx() sem re-renderizar props.
  // F5.x: renderCredentials chama transitionTo('mfa') em 401+mfaRequired.
  // F5.x: botão "Esqueceu sua senha?" chama transitionTo('forgot-password').
  const transitionTo = useCallback((next: AuthStep) => {
    setError(null);
    setStep(next);
  }, []);

  async function handleCredentialsSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        // LGPD-safe: nunca revela qual campo está errado
        setError('E-mail ou senha inválidos.');
        return;
      }

      const data = (await res.json()) as LoginResponse;
      setAuth({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });

      // F5.x — quando MFA disponível:
      // if (data.requiresMfa) { transitionTo('mfa'); return; }
      navigate(from, { replace: true });
    } catch {
      setError('Falha de conexão. Verifique sua rede e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function renderCredentials(): JSX.Element {
    const canSubmit = email !== '' && password !== '' && !loading;
    return (
      <form
        onSubmit={e => {
          void handleCredentialsSubmit(e);
        }}
        className="lp-form"
        noValidate
      >
        <div className="lp-field">
          <label htmlFor="lp-email" className="lp-label">
            E-mail institucional
          </label>
          <input
            id="lp-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Digite seu e-mail institucional"
            required
            autoComplete="username"
            className="lp-input"
            disabled={loading}
          />
        </div>

        <div className="lp-field">
          <div className="lp-field-row">
            <label htmlFor="lp-password" className="lp-label">
              Senha
            </label>
            {/* Desabilitado — F5.x: transitionTo('forgot-password') */}
            <button
              type="button"
              className="lp-forgot"
              disabled
              onClick={() => transitionTo('forgot-password')}
              title="Entre em contato com o administrador do sistema"
            >
              Esqueceu sua senha?
            </button>
          </div>
          <input
            id="lp-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="current-password"
            className="lp-input"
            disabled={loading}
          />
        </div>

        {error !== null && (
          <p className="lp-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={!canSubmit} className="lp-btn">
          {loading ? (
            <>
              <Loader2 size={15} className="lp-spinner" aria-hidden="true" />
              Entrando…
            </>
          ) : (
            'Entrar'
          )}
        </button>
      </form>
    );
  }

  // Dispatch por step.
  // F5.x: adicionar cases sem tocar renderCredentials().
  function renderStep(): JSX.Element {
    switch (step) {
      case 'credentials':
        return renderCredentials();
      // case 'mfa':             return renderMfa();
      // case 'forgot-password': return renderForgotPassword();
      // case 'reset-password':  return renderResetPassword();
      // case 'success':         return renderSuccess();
      default:
        return renderCredentials();
    }
  }

  return (
    <div className="lp-wrapper">
      <main className="lp-card">
        <header className="lp-header">
          <div className="lp-logo" aria-hidden="true">
            <Building2 size={26} strokeWidth={1.5} />
          </div>
          <h1 className="lp-title">SENAI Salas</h1>
          <p className="lp-subtitle">Sistema de Controle de Salas</p>
        </header>

        {renderStep()}
      </main>

      <footer className="lp-footer">SENAI Amazonas · v{APP_VERSION}</footer>

      <style>{`
        .lp-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: var(--color-bg);
          padding: 16px;
          gap: 14px;
        }
        .lp-card {
          width: 100%;
          max-width: 400px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          padding: 40px 32px 36px;
        }
        .lp-header {
          text-align: center;
          margin-bottom: 40px;
        }
        .lp-logo {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: var(--color-brand);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        .lp-title {
          margin: 0 0 6px;
          font-size: 18px;
          font-weight: 600;
          color: var(--color-text);
          font-family: Georgia, 'Times New Roman', serif;
          letter-spacing: -0.01em;
        }
        .lp-subtitle {
          margin: 0;
          font-size: 11px;
          color: var(--color-muted);
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .lp-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .lp-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .lp-field-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .lp-label {
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text);
        }
        .lp-forgot {
          font-size: 12px;
          color: var(--color-muted);
          background: none;
          border: none;
          padding: 0;
          cursor: default;
          opacity: 0.5;
          font-family: inherit;
        }
        .lp-input {
          padding: 9px 11px;
          border-radius: var(--radius-s);
          border: 1px solid var(--color-border);
          background: var(--color-bg);
          color: var(--color-text);
          font-size: 14px;
          width: 100%;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.15s;
          font-family: inherit;
        }
        .lp-input:focus {
          border-color: var(--color-brand);
        }
        .lp-input:disabled { opacity: 0.6; }
        .lp-input::placeholder { color: var(--color-muted); opacity: 1; }
        .lp-error {
          margin: 0;
          padding: 9px 11px;
          border-radius: var(--radius-s);
          border: 1px solid #fecaca;
          background: #fef2f2;
          color: #dc2626;
          font-size: 13px;
        }
        .lp-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          height: 38px;
          border-radius: var(--radius-s);
          background: var(--color-brand);
          color: #fff;
          border: none;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.15s;
          margin-top: 4px;
          width: 100%;
          font-family: inherit;
        }
        .lp-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .lp-btn:not(:disabled):hover { opacity: 0.9; }
        .lp-spinner {
          animation: lp-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        .lp-footer {
          font-size: 11px;
          color: var(--color-muted);
          text-align: center;
        }
        @keyframes lp-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

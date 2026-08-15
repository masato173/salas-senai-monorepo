import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2, Loader2 } from 'lucide-react';
// Mesma foto do Login (Pexels License, uso comercial livre) — ver
// pages/Login/index.tsx pro detalhe completo da licença/otimização.
import loginBg from '../../assets/images/login-lab.jpg';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const APP_VERSION = '1.0.0';

// RegisterPage — fora do AppLayout (sem sidebar, sem topbar), mesmo shell
// visual do Login (painel split + card de vidro dark-first, DESIGN.md).
//
// SEM auto-login (decisão de produto): sucesso só mostra confirmação e
// redireciona pro /login — o professor entra manualmente com a senha que
// acabou de escolher. Backend (POST /auth/register) sempre cria PROFESSOR,
// devolve 201 sem corpo.
//
// Rota separada de /login (não um step do AuthStep) — ver análise da missão:
// AuthStep é pra sub-estados de UMA tentativa de login já em andamento
// (mfa/forgot-password/reset-password), registro é a pessoa começando do
// zero, sem sessão nenhuma.
export default function RegisterPage(): JSX.Element {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        // 409 precisa de mensagem específica (o professor precisa saber que
        // foi o e-mail pra corrigir) — diferente do login, que esconde de
        // propósito qual campo errou. 400 cobre o e-mail fora do domínio
        // institucional (RegisterDto) — mensagem discreta de propósito,
        // não expõe qual domínio é exigido (mesma mensagem do backend).
        if (res.status === 409) {
          setError('Este email já está cadastrado.');
        } else if (res.status === 400) {
          setError('Use um e-mail institucional válido.');
        } else {
          setError('Não foi possível criar a conta. Tente novamente.');
        }
        return;
      }

      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch {
      setError('Falha de conexão. Verifique sua rede e tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = name !== '' && email !== '' && password.length >= 6 && !loading;

  function renderSuccess(): JSX.Element {
    return (
      <div className="rp-success" role="status">
        <CheckCircle2 size={40} className="rp-success-icon" aria-hidden="true" />
        <p className="rp-success-title">Conta criada com sucesso</p>
        <p className="rp-success-sub">Redirecionando para o login…</p>
      </div>
    );
  }

  function renderForm(): JSX.Element {
    return (
      <form onSubmit={e => void handleSubmit(e)} className="rp-form" noValidate>
        <div className="rp-field">
          <label htmlFor="rp-name" className="rp-label">
            Nome completo
          </label>
          <input
            id="rp-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Digite seu nome completo"
            required
            autoComplete="name"
            className="rp-input"
            disabled={loading}
          />
        </div>

        <div className="rp-field">
          <label htmlFor="rp-email" className="rp-label">
            E-mail institucional
          </label>
          <input
            id="rp-email"
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Digite seu e-mail institucional"
            required
            autoComplete="username"
            className="rp-input"
            disabled={loading}
          />
        </div>

        <div className="rp-field">
          <label htmlFor="rp-password" className="rp-label">
            Senha
          </label>
          <input
            id="rp-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            autoComplete="new-password"
            className="rp-input"
            disabled={loading}
          />
          <span className="rp-hint">Mínimo de 6 caracteres</span>
        </div>

        {error !== null && (
          <p className="rp-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={!canSubmit} className="rp-btn">
          {loading ? (
            <>
              <Loader2 size={17} className="rp-spinner" aria-hidden="true" />
              Criando conta…
            </>
          ) : (
            'Criar conta'
          )}
        </button>

        <p className="rp-footer-link">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    );
  }

  return (
    <div className="rp-wrapper">
      <div className="rp-shell">
        <aside className="rp-visual" aria-hidden="true">
          <img src={loginBg} alt="" className="rp-visual-img" />
          <div className="rp-visual-overlay" />
          <div className="rp-visual-text">
            <span className="rp-visual-brand">SENAI</span>
            <span className="rp-visual-accent" />
            <span className="rp-visual-sub">Controle de Salas</span>
          </div>
        </aside>

        <main className="rp-form-col">
          <div className="rp-card">
            <header className="rp-header">
              <div className="rp-logo" aria-hidden="true">
                <Building2 size={26} strokeWidth={1.5} />
              </div>
              <h1 className="rp-title">Criar conta</h1>
              <p className="rp-subtitle">Sistema de Controle de Salas</p>
            </header>

            {success ? renderSuccess() : renderForm()}
          </div>

          <footer className="rp-footer">SENAI Amazonas · v{APP_VERSION}</footer>
        </main>
      </div>

      <style>{`
        .rp-wrapper {
          min-height: 100vh;
        }
        .rp-shell {
          display: flex;
          min-height: 100vh;
        }
        .rp-visual {
          position: relative;
          flex: 0 0 54%;
          display: flex;
          align-items: flex-end;
          overflow: hidden;
        }
        .rp-visual-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .rp-visual-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(200deg, rgba(24, 45, 74, 0.8) 0%, rgba(16, 32, 54, 0.82) 45%, rgba(8, 16, 28, 0.95) 100%);
          backdrop-filter: blur(var(--glass-blur-s));
          -webkit-backdrop-filter: blur(var(--glass-blur-s));
        }
        .rp-visual-text {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 56px;
          animation: pageFadeIn 420ms var(--ease) both;
        }
        .rp-visual-brand {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 64px;
          font-weight: 700;
          letter-spacing: -1.5px;
          line-height: 1;
          color: #fff;
        }
        .rp-visual-accent {
          width: 32px;
          height: 3px;
          border-radius: 3px;
          background: var(--color-accent);
        }
        .rp-visual-sub {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.78);
        }
        .rp-form-col {
          flex: 1 1 46%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          gap: 16px;
        }
        .rp-card {
          position: relative;
          width: 100%;
          max-width: 540px;
          background: var(--color-surface);
          backdrop-filter: blur(var(--glass-blur-s)) saturate(140%);
          -webkit-backdrop-filter: blur(var(--glass-blur-s)) saturate(140%);
          border: 1px solid var(--color-border);
          border-radius: var(--radius);
          box-shadow: var(--shadow-s), var(--glass-sheen);
          padding: 48px 44px 44px;
        }
        .rp-header {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          padding: 0;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .rp-logo {
          width: 52px;
          height: 52px;
          border-radius: var(--radius-s);
          background: var(--color-brand);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        .rp-title {
          margin: 0 0 6px;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.4px;
          color: var(--color-text);
        }
        .rp-subtitle {
          margin: 0;
          font-size: 10px;
          font-weight: 600;
          color: var(--color-muted);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .rp-form {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .rp-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .rp-label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-muted);
        }
        .rp-hint {
          font-size: 11px;
          color: var(--color-subtle);
        }
        .rp-input {
          height: 48px;
          padding: 0 16px;
          border-radius: var(--radius-s);
          border: 1px solid var(--color-border);
          background: var(--color-surface);
          color: var(--color-text);
          font-family: inherit;
          font-size: 15px;
          width: 100%;
          box-sizing: border-box;
          outline: none;
          transition: border-color var(--dur) var(--ease);
        }
        .rp-input:focus {
          border-color: var(--color-brand);
        }
        .rp-input:disabled { opacity: 0.6; }
        .rp-input::placeholder { color: var(--color-subtle); opacity: 1; }
        .rp-error {
          margin: 0;
          padding: 12px 14px;
          border-radius: var(--radius-s);
          background: var(--color-red-l);
          color: var(--color-red);
          font-size: 14px;
          font-weight: 500;
        }
        .rp-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 50px;
          border-radius: var(--radius-s);
          background: var(--color-brand);
          color: #fff;
          border: none;
          font-family: inherit;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: background var(--dur) var(--ease);
          margin-top: 6px;
          width: 100%;
        }
        .rp-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .rp-btn:not(:disabled):hover { background: var(--color-brand-2); }
        .rp-spinner {
          animation: rp-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        .rp-footer-link {
          margin: 0;
          text-align: center;
          font-size: 13px;
          color: var(--color-muted);
        }
        .rp-footer-link a {
          color: var(--color-blue);
          font-weight: 600;
          text-decoration: none;
        }
        .rp-footer-link a:hover {
          text-decoration: underline;
        }
        .rp-footer {
          font-size: 11px;
          color: var(--color-muted);
          text-align: center;
        }
        .rp-success {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 6px;
          padding: 12px 0 4px;
          animation: pageFadeIn 420ms var(--ease) both;
        }
        .rp-success-icon {
          color: var(--color-green);
          margin-bottom: 8px;
        }
        .rp-success-title {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: var(--color-text);
        }
        .rp-success-sub {
          margin: 0;
          font-size: 13px;
          color: var(--color-muted);
        }
        @keyframes rp-spin { to { transform: rotate(360deg); } }
        @keyframes pageFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .rp-visual {
            display: none;
          }
          .rp-form-col {
            flex: 1 1 100%;
            padding: 16px;
          }
          .rp-header {
            position: static;
            width: auto;
            height: auto;
            margin: 0 0 24px;
            padding: 0;
            overflow: visible;
            clip: auto;
            white-space: normal;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
}

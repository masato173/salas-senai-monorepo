import React, { useCallback, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Building2, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import type { AuthUser, AuthStep } from '../../store/authStore';
// Foto de laboratório de informática — Pexels License (uso comercial livre,
// sem atribuição obrigatória), baixada e otimizada localmente (1600px,
// JPEG progressivo ~78% qualidade) — nunca hotlink. Fonte: Pexels, foto de
// Delot, https://www.pexels.com/photo/18471488/ (ver relatório da missão
// pra detalhe completo da licença).
import loginBg from '../../assets/images/login-lab.jpg';

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
// Design (Liquid Glass Deck — ver DESIGN.md):
//   - Layout split (≥768px): painel visual à esquerda (~54%, foto de
//     laboratório com overlay navy + blur) e formulário à direita (~46%,
//     card de vidro). Abaixo de 768px (mesmo breakpoint do resto do app,
//     confirmado em global.css) o painel visual desaparece por completo —
//     decisão de design: uma faixa fina no topo ficaria espremida/cortando
//     mal a foto numa tela estreita; sumir é mais limpo que um meio-termo
//     ruim. O formulário ocupa a tela inteira, como na versão anterior.
//   - A marca ("SENAI" grande + "Controle de Salas") vive só no painel
//     visual em desktop — não duplicada no formulário (decisão do
//     entrevistado). O <h1>/ícone do card continuam no DOM sempre (nunca
//     display:none) só visualmente ocultos em desktop via clip
//     (padrão "visually-hidden"), e reaparecem em mobile — mantém um
//     heading real acessível por leitor de tela nas duas larguras.
//   - Barra de 3px em --color-accent morou no card antes; agora vive no
//     painel visual, junto do texto de marca (The Rare Ember Rule lista
//     "barra de 3px" como uso permitido — mesmo dispositivo do indicador
//     ativo da sidebar, só realocado)
//   - Painel visual é tratado como theme-invariant (mesma lógica já
//     documentada da sidebar em DESIGN.md — superfície escura por natureza,
//     não precisa de contraparte dark) — sem --glass-sheen no próprio
//     painel: é fundo full-bleed sem cantos/borda, não um card elevado
//     (sheen é pra distinguir vidro de "cinza com blur" em superfícies
//     elevadas; aqui não há elevação a distinguir). O card do formulário
//     continua com sheen normalmente.
//   - Ícone Building2 (lucide) em container sólido --color-brand (mesmo
//     padrão de .topbar-avatar/.sidebar-logo-icon — nunca glass, cor chapada)
//   - Card com a receita de vidro de 3 partes (surface + backdrop-filter +
//     shadow com sheen) sobre o fundo da coluna direita
//   - Título em DM Sans (The One Voice Rule — sem serif, sem segunda fonte)
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
              <Loader2 size={17} className="lp-spinner" aria-hidden="true" />
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
      <div className="lp-shell">
        <aside className="lp-visual" aria-hidden="true">
          <img src={loginBg} alt="" className="lp-visual-img" />
          <div className="lp-visual-overlay" />
          <div className="lp-visual-text">
            <span className="lp-visual-brand">SENAI</span>
            <span className="lp-visual-accent" />
            <span className="lp-visual-sub">Controle de Salas</span>
          </div>
        </aside>

        <main className="lp-form-col">
          <div className="lp-card">
            <header className="lp-header">
              <div className="lp-logo" aria-hidden="true">
                <Building2 size={26} strokeWidth={1.5} />
              </div>
              <h1 className="lp-title">SENAI Salas</h1>
              <p className="lp-subtitle">Sistema de Controle de Salas</p>
            </header>

            {renderStep()}
          </div>

          <footer className="lp-footer">SENAI Amazonas · v{APP_VERSION}</footer>
        </main>
      </div>

      <style>{`
        .lp-wrapper {
          min-height: 100vh;
        }
        .lp-shell {
          display: flex;
          min-height: 100vh;
        }
        /* Painel visual — full-bleed, theme-invariant (mesma lógica já
           documentada da sidebar: superfície escura por natureza, sem
           contraparte dark). Sem --glass-sheen aqui: é fundo full-bleed
           sem borda/canto, não um card elevado — ver comentário no topo
           do arquivo. */
        .lp-visual {
          position: relative;
          flex: 0 0 54%;
          display: flex;
          align-items: flex-end;
          overflow: hidden;
        }
        .lp-visual-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        /* Overlay navy da marca (rgba derivado de --color-brand/-brand-2,
           mesma técnica já usada em --sidebar-bg) + blur --glass-blur-s
           (The Two-Blur Rule) no "espírito liquid glass" pedido na missão —
           mais escuro embaixo, onde o texto fica, mais claro em cima.
           Alpha alto (0.78+) em toda a extensão porque a foto original é
           uma sala muito clara/branca — um wash mais leve (~0.5) deixava a
           imagem esbranquiçada em vez de escurecida, testado visualmente. */
        .lp-visual-overlay {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(200deg, rgba(24, 45, 74, 0.8) 0%, rgba(16, 32, 54, 0.82) 45%, rgba(8, 16, 28, 0.95) 100%);
          backdrop-filter: blur(var(--glass-blur-s));
          -webkit-backdrop-filter: blur(var(--glass-blur-s));
        }
        .lp-visual-text {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 56px;
          animation: pageFadeIn 420ms var(--ease) both;
        }
        .lp-visual-brand {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 64px;
          font-weight: 700;
          letter-spacing: -1.5px;
          line-height: 1;
          color: #fff;
        }
        /* Barra de 3px em --color-accent — realocada do card (ver topo do
           arquivo); "The Rare Ember Rule" lista barra de 3px como uso
           permitido, mesmo dispositivo do indicador ativo da sidebar. */
        .lp-visual-accent {
          width: 32px;
          height: 3px;
          border-radius: 3px;
          background: var(--color-accent);
        }
        .lp-visual-sub {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.78);
        }
        .lp-form-col {
          flex: 1 1 46%;
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 16px;
          gap: 16px;
        }
        .lp-card {
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
        /* Visualmente oculto em desktop (marca já aparece no painel visual,
           ver topo do arquivo) mas sempre presente no DOM — heading real
           acessível por leitor de tela nas duas larguras. Reaparece
           visualmente em mobile (ver media query abaixo). */
        .lp-header {
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
        .lp-logo {
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
        .lp-title {
          margin: 0 0 6px;
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.4px;
          color: var(--color-text);
        }
        .lp-subtitle {
          margin: 0;
          font-size: 10px;
          font-weight: 600;
          color: var(--color-muted);
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .lp-form {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }
        .lp-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .lp-field-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        /* Rótulo, input e botão maiores que a receita padrão de
           input-search/button-secondary do DESIGN.md (34px/12px) —
           exceção pontual pedida pro card de login, que agora tem uma
           coluna dedicada (~46%) e espaço de sobra; não muda o token
           documentado pros inputs do resto do sistema (tabelas, filtros
           etc.), só este card. */
        .lp-label {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--color-muted);
        }
        .lp-forgot {
          font-size: 13px;
          color: var(--color-muted);
          background: none;
          border: none;
          padding: 0;
          cursor: default;
          opacity: 0.5;
          font-family: inherit;
        }
        .lp-input {
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
        .lp-input:focus {
          border-color: var(--color-brand);
        }
        .lp-input:disabled { opacity: 0.6; }
        .lp-input::placeholder { color: var(--color-subtle); opacity: 1; }
        .lp-error {
          margin: 0;
          padding: 12px 14px;
          border-radius: var(--radius-s);
          background: var(--color-red-l);
          color: var(--color-red);
          font-size: 14px;
          font-weight: 500;
        }
        .lp-btn {
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
        .lp-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .lp-btn:not(:disabled):hover { background: var(--color-brand-2); }
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

        /* Mesmo breakpoint do resto do app (768px, ver global.css) — painel
           visual desaparece por completo (decisão de design, ver comentário
           no topo do arquivo) e o heading do card volta a ficar visível. */
        @media (max-width: 768px) {
          .lp-visual {
            display: none;
          }
          .lp-form-col {
            flex: 1 1 100%;
            padding: 16px;
          }
          .lp-header {
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

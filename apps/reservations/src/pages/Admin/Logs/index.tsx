import { FileText, CheckCircle2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────
// AdminLogsPage — F6.8
//
// Página estática: sem service, sem hooks.
// Card 1 — Audit Trail (disponível agora, link → /admin/auditoria)
// Card 2 — Logs de Servidor (planejado F8+)
// ─────────────────────────────────────────────────────────────

export default function AdminLogsPage(): JSX.Element {
  return (
    <div style={{ padding: '28px 24px', maxWidth: 760 }}>
      {/* ─ Header ─ */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'var(--color-brand)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <FileText size={18} color="#fff" />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: 'var(--color-text)' }}>
            Logs do Sistema
          </h1>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted)' }}>
            Rastreamento de eventos e atividades da plataforma.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* ─ Card 1: Audit Trail (disponível) ─ */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid rgba(22,163,74,.35)',
            borderLeft: '3px solid var(--color-green)',
            borderRadius: 10,
            padding: '20px 20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: 'var(--color-green-l)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={20} color="var(--color-green)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
                  Audit Trail
                </span>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '1px 8px',
                    borderRadius: 20,
                    fontSize: 10,
                    fontWeight: 700,
                    background: 'var(--color-green-l)',
                    color: 'var(--color-green)',
                    border: '1px solid rgba(22,163,74,.3)',
                    textTransform: 'uppercase',
                    letterSpacing: '.04em',
                  }}
                >
                  Disponível
                </span>
              </div>
              <p
                style={{
                  margin: '0 0 14px',
                  fontSize: 13,
                  color: 'var(--color-muted)',
                  lineHeight: 1.55,
                }}
              >
                Registro completo de ações administrativas: aprovações, rejeições, sincronizações,
                alterações de usuários e muito mais.
              </p>
              <Link
                to="/admin/auditoria"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '7px 16px',
                  borderRadius: 6,
                  background: 'var(--color-brand)',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: 'none',
                }}
              >
                Ver Auditoria →
              </Link>
            </div>
          </div>
        </div>

        {/* ─ Card 2: Logs de Servidor (planejado) ─ */}
        <div
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            padding: '20px 20px',
            opacity: 0.8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 8,
                background: 'var(--color-surface-2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Clock size={20} color="var(--color-muted)" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text)' }}>
                  Logs de Servidor
                </span>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: 10,
                    fontSize: 11,
                    fontWeight: 600,
                    background: 'var(--color-amber-l)',
                    color: 'var(--color-amber)',
                  }}
                >
                  Planejado para F8+
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: 'var(--color-muted)',
                  lineHeight: 1.55,
                }}
              >
                Logs estruturados de stdout/stderr, rastreamento de erros de runtime e integração
                com ferramentas de observabilidade (ex: Sentry, Railway Logs).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

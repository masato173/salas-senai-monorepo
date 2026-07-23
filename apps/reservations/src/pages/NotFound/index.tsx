import { Link, useLocation } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  const { pathname } = useLocation();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        textAlign: 'center',
        gap: '16px',
        padding: '24px',
      }}
    >
      <div
        style={{
          fontSize: '72px',
          fontWeight: 800,
          lineHeight: 1,
          color: 'var(--color-border-2)',
          fontFamily: 'DM Sans, system-ui, sans-serif',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        404
      </div>
      <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text)' }}>
        Página não encontrada
      </div>
      <div style={{ fontSize: '13px', color: 'var(--color-muted)', maxWidth: '300px' }}>
        A rota{' '}
        <code
          style={{
            fontFamily: 'DM Sans, system-ui, sans-serif',
            fontVariantNumeric: 'tabular-nums',
            fontSize: '12px',
            background: 'var(--color-surface-2)',
            padding: '2px 6px',
            borderRadius: '4px',
            border: '1px solid var(--color-border)',
          }}
        >
          {pathname}
        </code>{' '}
        não existe neste sistema.
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: 'var(--radius-s)',
            background: 'var(--color-brand)',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: 'inherit',
            textDecoration: 'none',
          }}
        >
          <Home size={14} /> Ir para o início
        </Link>
        <button
          onClick={() => window.history.back()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: 'var(--radius-s)',
            background: 'none',
            border: '1px solid var(--color-border)',
            color: 'var(--color-muted)',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={14} /> Voltar
        </button>
      </div>
    </div>
  );
}

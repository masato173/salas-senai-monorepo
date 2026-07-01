/**
 * Fallback de loading para Suspense.
 * Aparece durante o lazy load de cada página.
 * Usa CSS puro — sem dependência de Tailwind aqui
 * para não bloquear a primeira renderização.
 */
export function RouteLoader() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '320px',
        gap: '16px',
      }}
    >
      <div
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: '3px solid #e4e6ea',
          borderTopColor: '#1e3a5f',
          animation: 'routeLoaderSpin .7s linear infinite',
        }}
      />
      <style>{`
        @keyframes routeLoaderSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <p style={{ fontSize: '13px', color: '#8b949e' }}>Carregando...</p>
    </div>
  );
}

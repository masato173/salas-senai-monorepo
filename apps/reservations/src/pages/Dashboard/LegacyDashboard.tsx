import React, { useEffect, useRef } from 'react';

/**
 * Embute o sistema legado (Apps Script + Sheets) dentro do React.
 *
 * Estratégia: iframe apontando para o index.html legado.
 * Vantagens:
 *   - Legado 100% intacto, sem adaptação
 *   - JS/CSS do legado não conflita com o React
 *   - Apps Script continua funcionando sem mudança
 *
 * Alternativa futura (Fase 3): migrar cada componente para React.
 * Enquanto isso, o iframe é a forma mais segura de coexistência.
 */
export function LegacyDashboard() {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Ajusta a altura do iframe para o conteúdo (evita scroll duplo)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    function handleLoad() {
      try {
        const height = iframe?.contentDocument?.body?.scrollHeight;
        if (height && iframe) {
          iframe.style.height = `${height + 32}px`;
        }
      } catch {
        // Cross-origin: usa altura fixa
        if (iframe) iframe.style.height = '1200px';
      }
    }

    iframe.addEventListener('load', handleLoad);
    return () => iframe.removeEventListener('load', handleLoad);
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src="/legacy-index.html"
      title="Dashboard legado — Controle de Salas"
      style={{
        width:        '100%',
        minHeight:    '600px',
        border:       'none',
        borderRadius: '10px',
        display:      'block',
      }}
      // sandbox permite scripts e forms mas bloqueia modais e navegação
      sandbox="allow-scripts allow-forms allow-same-origin"
    />
  );
}

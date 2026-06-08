import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
}

/**
 * Envolve o conteúdo da página com animação de entrada.
 * CSS puro — sem Framer Motion nessa fase para manter o bundle pequeno.
 * Troca a classe a cada mudança de rota, disparando o keyframe.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const { pathname } = useLocation();
  const ref          = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove('page-enter');
    // Force reflow para reiniciar a animação
    void el.offsetHeight;
    el.classList.add('page-enter');
  }, [pathname]);

  return (
    <div ref={ref} className="page-enter">
      {children}
    </div>
  );
}

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProfessorTag } from '../OccupancyUnified';

// O projeto não usa @testing-library; renderToStaticMarkup (react-dom, já
// dependência) basta pra provar o escape e os atributos sem montar DOM.
function render(name: string): string {
  return renderToStaticMarkup(createElement(ProfessorTag, { name }));
}

describe('ProfessorTag', () => {
  it('exibe "Prof. <nome>"', () => {
    expect(render('Ana Ficticia')).toContain('Prof. Ana Ficticia');
  });

  it('nome com HTML é exibido como TEXTO (escapado), nunca como tag', () => {
    const html = render('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('nome longo: title acessível com o nome completo + truncamento por CSS', () => {
    const longo = 'Ana Maria da Silva Ficticia de Souza Pereira Albuquerque';
    const html = render(longo);
    expect(html).toContain(`title="Prof. ${longo}"`);
    expect(html).toContain('text-overflow:ellipsis');
  });
});

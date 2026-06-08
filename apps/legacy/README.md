# apps/legacy

Sistema legado funcional em produção.

**NÃO modificar** sem planejamento e testes de regressão.

## Arquivos

- `index.html` — frontend completo (HTML + CSS + JS inline)
- `codigo.gs`  — Google Apps Script (backend)

## Deploy

O `index.html` é servido pelo GitHub Pages.
O `codigo.gs` roda no Google Apps Script (reimplantar após mudanças).

## Status

✓ Em produção  
✓ Funcional  
✓ Protegido por esc() contra XSS  
✓ filtros: turma, data, sala, mês, turno (M/V/N)  

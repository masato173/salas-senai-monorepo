#!/bin/bash
# Valida que o sistema legado não foi quebrado
# Executar antes de qualquer merge na main

set -e

echo "=== Validando sistema legado ==="

# 1. Verifica que index.html existe
[ -f "apps/legacy/index.html" ] || { echo "ERRO: index.html não encontrado"; exit 1; }

# 2. Verifica que esc() está presente (proteção XSS)
grep -q "function esc" apps/legacy/index.html || { echo "ERRO: esc() removida"; exit 1; }

# 3. Verifica que API_URL está presente
grep -q "API_URL" apps/legacy/index.html || { echo "ERRO: API_URL ausente"; exit 1; }

# 4. Verifica que todos os filtros estão presentes
for fn in applyFilters getTurno render buildSelects; do
  grep -q "$fn" apps/legacy/index.html || { echo "ERRO: $fn ausente"; exit 1; }
done

# 5. Verifica que codigo.gs existe e tem funções essenciais
[ -f "apps/legacy/codigo.gs" ] || { echo "ERRO: codigo.gs não encontrado"; exit 1; }
grep -q "doGet" apps/legacy/codigo.gs   || { echo "ERRO: doGet ausente";   exit 1; }
grep -q "getTurnoMap" apps/legacy/codigo.gs || { echo "ERRO: getTurnoMap ausente"; exit 1; }

echo "✓ Sistema legado validado com sucesso"

import { z } from 'zod';

// Schema de validação das env vars com Zod
// Falha em build-time se variável obrigatória estiver faltando
const envSchema = z.object({
  VITE_APPS_SCRIPT_URL:   z.string().url('VITE_APPS_SCRIPT_URL deve ser uma URL válida'),
  VITE_APPS_SCRIPT_TOKEN: z.string().min(1, 'VITE_APPS_SCRIPT_TOKEN não pode ser vazio'),
  VITE_PER_PAGE:          z.coerce.number().int().positive().default(40),
});

// Em produção (Vite), usa import.meta.env
// Em testes (Vitest), usa process.env como fallback
const raw = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env
  : process.env;

const parsed = envSchema.safeParse(raw);

if (!parsed.success) {
  console.error('[Config] Variáveis de ambiente inválidas:');
  console.error(parsed.error.flatten().fieldErrors);
  // Em dev: avisa mas continua. Em produção: erro fatal.
  if (raw['NODE_ENV'] === 'production') {
    throw new Error('Configuração de ambiente inválida. Ver logs.');
  }
}

export const config = parsed.success
  ? parsed.data
  : {
      VITE_APPS_SCRIPT_URL:   '',
      VITE_APPS_SCRIPT_TOKEN: '',
      VITE_PER_PAGE:          40,
    };

// Constantes de UI (não vêm do env)
export const DAYS        = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
export const TURNO_LABEL = { M: 'Matutino', V: 'Vespertino', N: 'Noturno' } as const;
export const TURNOS_VALIDOS = ['M', 'V', 'N'] as const;

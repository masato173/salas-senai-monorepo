/// <reference types="vite/client" />

// Declaração explícita das variáveis de ambiente VITE_* usadas pelo projeto.
// Manter em sincronia com .env.example.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_BACKEND_DRIVER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

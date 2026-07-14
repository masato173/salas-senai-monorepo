// Fonte única de verdade para URL do backend.
// Usado por apiClient.ts e socketClient.ts.
export const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

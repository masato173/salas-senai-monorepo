/**
 * Erro de domínio da aplicação.
 * Distingue erros esperados (validação, negócio) de erros
 * inesperados (rede, servidor) para tratamento correto no frontend.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'API_ERROR'
  | 'PARSE_ERROR'
  | 'NOT_FOUND'
  | 'UNKNOWN_ERROR';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  /** Erro esperado — mostrar mensagem ao usuário */
  get isUserFacing(): boolean {
    return this.code === 'VALIDATION_ERROR' || this.code === 'NOT_FOUND';
  }

  static validation(message: string, cause?: unknown): AppError {
    return new AppError('VALIDATION_ERROR', message, cause);
  }

  static api(message: string, cause?: unknown): AppError {
    return new AppError('API_ERROR', message, cause);
  }

  static parse(message: string, cause?: unknown): AppError {
    return new AppError('PARSE_ERROR', message, cause);
  }
}

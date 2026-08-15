import { IsString, IsNotEmpty, IsEmail, Matches, MinLength, MaxLength } from 'class-validator';

// Sem campo `role` de propósito: o registro é público e SEMPRE cria
// PROFESSOR (default do schema Prisma). Não adicionar `role` aqui — o
// ValidationPipe global (whitelist+forbidNonWhitelisted) já rejeita com 400
// qualquer campo fora do DTO, e UsersService.create() nem aceita `role` como
// parâmetro. As duas camadas juntas são a proteção real; um `role?: Role`
// "pra genericidade" quebraria as duas de uma vez.
export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  // @IsEmail() valida formato; @Matches é ADICIONAL — restringe ao domínio
  // institucional (registro público só faz sentido pra quem é do SENAI-AM).
  // Âncora `$` no fim da regex é obrigatória: sem ela, algo como
  // "fulano@am.senai.br.attacker.com" passaria (o domínio real seria
  // attacker.com, com "am.senai.br" só como subdomínio disfarçado). O ponto
  // é escapado (`\.`) porque `.` sem escape na regex casa qualquer
  // caractere, não só ponto literal. Só afeta o registro público — login,
  // seed.ts (usuários de teste em @senai.edu) e criação administrativa de
  // usuário não passam por este DTO.
  // Mensagem deliberadamente discreta — não expõe o domínio exigido (evita
  // dar pista de qual formato de e-mail o sistema aceita).
  @IsEmail()
  @Matches(/@am\.senai\.br$/i, { message: 'Use um e-mail institucional válido.' })
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;
}

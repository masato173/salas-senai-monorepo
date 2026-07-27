import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

// Namespace /rooms — auth JWT no handshake (F4.10b).
// Cliente envia token em: io('/rooms', { auth: { token: accessToken } })
// Conexões sem token válido são desconectadas antes de receber eventos.
@WebSocketGateway({
  namespace: '/rooms',
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.['token'] as string | undefined;

    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      // Armazena dados do usuário no socket para uso futuro (rooms por role, F4.10c)
      client.data = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      };
      // Fase C2 — room nomeada com o próprio userId: permite emitir
      // notificação DIRECIONADA (server.to(userId).emit(...)) sem broadcast
      // global. join() retorna Promise<void> | void dependendo do adapter
      // (confirmado no .d.ts do socket.io instalado) — não precisamos
      // aguardar, só evitar floating promise.
      void client.join(payload.sub);
    } catch {
      // Token inválido ou expirado — desconecta sem vazar detalhes do erro
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket): void {
    // No-op — nenhum cleanup manual de room necessário. Confirmado lendo o
    // código-fonte do socket.io instalado (socket.js): o fluxo interno de
    // disconnect chama _cleanup() -> leaveAll(), removendo o socket de
    // TODAS as rooms (inclusive a room de userId da Fase C2) antes mesmo
    // do evento "disconnect" ser emitido — não é suposição, é o
    // comportamento real do pacote.
  }
}

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
    } catch {
      // Token inválido ou expirado — desconecta sem vazar detalhes do erro
      client.disconnect();
    }
  }

  handleDisconnect(_client: Socket): void {
    // No-op nesta fase — cleanup de rooms e sessões virá em F4.10c
  }
}

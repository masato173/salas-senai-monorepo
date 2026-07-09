import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';

// Namespace /rooms — broadcast global sem autenticação (F4.10).
// Auth de handshake JWT será implementada em F4.10b.
@WebSocketGateway({
  namespace: '/rooms',
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:4173'],
    credentials: true,
  },
})
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;
}

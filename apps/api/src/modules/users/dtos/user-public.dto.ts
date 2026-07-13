import type { Role } from '@prisma/client';

export interface UserPublicDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  createdAt: Date;
}

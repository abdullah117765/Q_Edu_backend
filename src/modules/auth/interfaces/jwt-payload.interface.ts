import { Role } from '../../users/entities/role.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}
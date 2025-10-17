import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from './role.enum';
import { UserStatus } from './user-status.enum';

export class UserEntity {
  constructor(partial: Partial<UserEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ example: 'ckv123example' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'Jane' })
  firstName!: string;

  @ApiPropertyOptional({ example: 'Doe' })
  lastName?: string | null;

  @ApiProperty({ example: '+1 555 123 4567' })
  phoneNumber?: string | null;

  @ApiProperty({ enum: Role, example: Role.STUDENT })
  role!: Role;

  @ApiProperty({ enum: UserStatus, example: UserStatus.APPROVED })
  status!: UserStatus;

  @ApiPropertyOptional({ example: 'Incomplete documents' })
  rejectionReason?: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ example: '2025-01-01T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2025-01-02T12:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ type: Object })
  _count?: Record<string, number> | null;
}

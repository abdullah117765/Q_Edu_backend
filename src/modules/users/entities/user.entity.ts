import { AcademyMembershipStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Role } from './role.enum';
import { UserStatus } from './user-status.enum';

export class UserAcademyMembershipSummary {
  constructor(partial: Partial<UserAcademyMembershipSummary>) {
    Object.assign(this, partial);
  }

  @ApiProperty()
  academyId!: string;

  @ApiPropertyOptional()
  academyName?: string | null;

  @ApiProperty({ enum: AcademyMembershipStatus })
  status!: AcademyMembershipStatus;
}

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

  @ApiPropertyOptional({ example: 'Non-binary unicorn' })
  gender?: string | null;

  @ApiPropertyOptional({
    example: 'Educator who loves project-based adventures and storytelling.',
  })
  bio?: string | null;

  @ApiPropertyOptional({ example: '2001-05-25T00:00:00.000Z' })
  dateOfBirth?: Date | null;

  @ApiPropertyOptional({ example: 'Sunset Boulevard' })
  addressStreet?: string | null;

  @ApiPropertyOptional({ example: '42B' })
  addressHouse?: string | null;

  @ApiPropertyOptional({ example: 'Emerald City' })
  addressCity?: string | null;

  @ApiPropertyOptional({ example: 'Oz Territory' })
  addressState?: string | null;

  @ApiPropertyOptional({ example: 'Wonderland' })
  addressCountry?: string | null;

  @ApiPropertyOptional({ example: '/storage/profile-photos/abc123.png' })
  profilePhotoUrl?: string | null;

  @ApiPropertyOptional()
  profilePhotoKey?: string | null;

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

  @ApiPropertyOptional({ type: () => [UserAcademyMembershipSummary] })
  academies?: UserAcademyMembershipSummary[];

  @ApiPropertyOptional({ type: Object })
  _count?: Record<string, number> | null;
}

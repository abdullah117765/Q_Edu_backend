import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AcademyMemberRole,
  AcademyMembershipStatus,
  Role as PrismaRole,
  UserStatus as PrismaUserStatus,
} from '@prisma/client';

export class AcademySummaryEntity {
  constructor(partial: Partial<AcademySummaryEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class AcademyDetailEntity extends AcademySummaryEntity {
  constructor(partial: Partial<AcademyDetailEntity>) {
    super(partial);
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Count of approved teacher members' })
  teacherCount!: number;

  @ApiProperty({ description: 'Count of approved student members' })
  studentCount!: number;

  @ApiProperty({ description: 'Pending membership requests awaiting review' })
  pendingCount!: number;
}

export class AcademyMembershipUserSummary {
  constructor(partial: Partial<AcademyMembershipUserSummary>) {
    Object.assign(this, partial);
  }

  @ApiProperty()
  id!: string;

  @ApiProperty()
  firstName!: string;

  @ApiPropertyOptional()
  lastName?: string | null;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: PrismaRole })
  role!: PrismaRole;

  @ApiProperty({ enum: PrismaUserStatus })
  status!: PrismaUserStatus;
}

export class AcademyMembershipEntity {
  constructor(partial: Partial<AcademyMembershipEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty()
  id!: string;

  @ApiProperty()
  academyId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: AcademyMemberRole })
  role!: AcademyMemberRole;

  @ApiProperty({ enum: AcademyMembershipStatus })
  status!: AcademyMembershipStatus;

  @ApiProperty()
  requestedAt!: Date;

  @ApiPropertyOptional()
  respondedAt?: Date | null;

  @ApiPropertyOptional()
  reason?: string | null;

  @ApiPropertyOptional()
  actionedById?: string | null;

  @ApiPropertyOptional({ type: () => AcademyMembershipUserSummary })
  user?: AcademyMembershipUserSummary;

  @ApiPropertyOptional({ type: () => AcademySummaryEntity })
  academy?: AcademySummaryEntity;
}

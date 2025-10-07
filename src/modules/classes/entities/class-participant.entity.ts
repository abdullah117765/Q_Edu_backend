import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClassParticipantRole } from './class-participant-role.enum';

export class ClassParticipantEntity {
  constructor(partial: Partial<ClassParticipantEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty()
  id!: string;

  @ApiProperty()
  classId!: string;

  @ApiPropertyOptional()
  userId?: string | null;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  displayName?: string | null;

  @ApiPropertyOptional({ enum: ClassParticipantRole })
  role?: ClassParticipantRole;

  @ApiPropertyOptional()
  joinTime?: Date | null;

  @ApiPropertyOptional()
  leaveTime?: Date | null;

  @ApiPropertyOptional()
  durationSeconds?: number | null;

  @ApiPropertyOptional({ type: Object })
  metadata?: Record<string, unknown> | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClassStatus } from './class-status.enum';
import { ClassParticipantEntity } from './class-participant.entity';

export class ClassTeacherSummaryEntity {
  constructor(partial: Partial<ClassTeacherSummaryEntity>) {
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
}

export class ClassEntity {
  constructor(partial: Partial<ClassEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty()
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  teacherId!: string;

  @ApiProperty({ enum: ClassStatus })
  status!: ClassStatus;

  @ApiProperty()
  scheduledStart!: Date;

  @ApiProperty()
  scheduledEnd!: Date;

  @ApiProperty({ description: 'Planned duration in minutes' })
  durationMinutes!: number;

  @ApiProperty()
  timezone!: string;

  @ApiPropertyOptional({ description: 'Credits consumed or allocated for the class' })
  creditsConsumed?: number | null;

  @ApiPropertyOptional()
  zoomMeetingId?: string | null;

  @ApiPropertyOptional()
  zoomHostId?: string | null;

  @ApiPropertyOptional()
  zoomJoinUrl?: string | null;

  @ApiPropertyOptional()
  zoomStartUrl?: string | null;

  @ApiPropertyOptional()
  zoomPassword?: string | null;

  @ApiPropertyOptional()
  zoomUuid?: string | null;

  @ApiPropertyOptional({ type: Object })
  metadata?: Record<string, unknown> | null;

  @ApiPropertyOptional({ type: () => ClassTeacherSummaryEntity })
  teacher?: ClassTeacherSummaryEntity;

  @ApiProperty({ description: 'Number of participants stored for the class' })
  participantsCount!: number;

  @ApiPropertyOptional({ type: () => [ClassParticipantEntity] })
  participants?: ClassParticipantEntity[];

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

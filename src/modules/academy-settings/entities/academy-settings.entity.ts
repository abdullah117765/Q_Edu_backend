import { ApiProperty } from '@nestjs/swagger';

export class AcademySettingsEntity {
  constructor(partial: Partial<AcademySettingsEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty({
    description: 'Allow teachers to self-register under this academy',
    example: true,
  })
  allowTeacherSelfRegistration!: boolean;

  @ApiProperty({
    description: 'Automatically approve new student registrations',
    example: false,
  })
  autoApproveStudents!: boolean;

  @ApiProperty({
    description: 'Send notifications to the owner when new users register',
    example: true,
  })
  notifyOwnerOnNewRegistration!: boolean;

  @ApiProperty({
    description: 'Require Zoom meetings to include passwords by default',
    example: true,
  })
  requireZoomPassword!: boolean;

  @ApiProperty({
    description: 'Default duration for new classes in minutes',
    example: 60,
  })
  defaultClassDurationMinutes!: number;

  @ApiProperty({
    description: 'Timestamp of the most recent update',
    example: '2025-01-01T12:00:00.000Z',
  })
  updatedAt!: Date;
}

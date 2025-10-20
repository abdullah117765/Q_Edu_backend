import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlatformSettingsEntity {
  constructor(partial: Partial<PlatformSettingsEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ description: 'Allow teachers to self-register accounts', example: false })
  allowTeacherSelfRegistration!: boolean;

  @ApiProperty({ description: 'Automatically approve newly registered students', example: false })
  autoApproveStudents!: boolean;

  @ApiProperty({ description: 'Platform session timeout in minutes', example: 60 })
  sessionTimeoutMinutes!: number;

  @ApiProperty({ description: 'Threshold (credits) that triggers low balance alerts', example: 100 })
  zoomCreditLowThreshold!: number;

  @ApiProperty({ description: 'Maximum number of concurrent live classes allowed', example: 12 })
  maxConcurrentClasses!: number;

  @ApiProperty({ description: 'Send daily operational digest emails to admins', example: true })
  dailyDigestEmail!: boolean;

  @ApiProperty({ description: 'Primary support email shown to users', example: 'support@qedu.io' })
  supportEmail!: string;

  @ApiProperty({ description: 'Timestamp of the last settings update', example: '2025-01-01T12:00:00.000Z' })
  updatedAt!: Date;

  @ApiPropertyOptional({ description: 'Identifier of the user who last updated the settings', example: 'user_123' })
  updatedById?: string | null;

  @ApiPropertyOptional({ description: 'Display name of the user who last updated the settings', example: 'Jane Doe' })
  updatedByName?: string | null;
}

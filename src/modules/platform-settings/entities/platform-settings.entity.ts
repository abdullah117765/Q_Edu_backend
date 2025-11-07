import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlatformSettingsEntity {
  constructor(partial: Partial<PlatformSettingsEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty({
    description: 'Platform session timeout in minutes',
    example: 60,
  })
  sessionTimeoutMinutes!: number;

  @ApiProperty({
    description: 'Threshold (credits) that triggers low balance alerts',
    example: 100,
  })
  zoomCreditLowThreshold!: number;

  @ApiProperty({
    description: 'Maximum number of concurrent live classes allowed',
    example: 12,
  })
  maxConcurrentClasses!: number;

  @ApiProperty({
    description: 'Send daily operational digest emails to admins',
    example: true,
  })
  dailyDigestEmail!: boolean;

  @ApiProperty({
    description: 'Primary support email shown to users',
    example: 'support@qedu.io',
  })
  supportEmail!: string;

  @ApiProperty({
    description: 'Maximum number of academies a teacher can join',
    example: 3,
  })
  maxAcademiesPerTeacher!: number;

  @ApiProperty({
    description: 'Maximum number of academies a student can join',
    example: 2,
  })
  maxAcademiesPerStudent!: number;

  @ApiProperty({
    description: 'Enable host video when meetings start',
    example: true,
  })
  zoomHostVideoEnabled!: boolean;

  @ApiProperty({
    description: 'Enable participant video when they join',
    example: false,
  })
  zoomParticipantVideoEnabled!: boolean;

  @ApiProperty({
    description: 'Allow attendees to join before the host',
    example: false,
  })
  zoomJoinBeforeHost!: boolean;

  @ApiProperty({
    description: 'Mute everyone upon entry',
    example: true,
  })
  zoomMuteUponEntry!: boolean;

  @ApiProperty({
    description: 'Enable the Zoom waiting room',
    example: true,
  })
  zoomWaitingRoomEnabled!: boolean;

  @ApiProperty({
    description: 'Default automatic recording behaviour',
    example: 'cloud',
    enum: ['local', 'cloud', 'none'],
  })
  zoomAutoRecordingMode!: 'local' | 'cloud' | 'none';

  @ApiProperty({
    description: 'Audio transport permitted for meetings',
    example: 'both',
    enum: ['both', 'telephony', 'voip'],
  })
  zoomAudioType!: 'both' | 'telephony' | 'voip';

  @ApiProperty({
    description: 'Enable in-meeting chat for participants',
    example: false,
  })
  zoomChatEnabled!: boolean;

  @ApiProperty({
    description: 'Timestamp of the last settings update',
    example: '2025-01-01T12:00:00.000Z',
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'Identifier of the user who last updated the settings',
    example: 'user_123',
  })
  updatedById?: string | null;

  @ApiPropertyOptional({
    description: 'Display name of the user who last updated the settings',
    example: 'Jane Doe',
  })
  updatedByName?: string | null;
}

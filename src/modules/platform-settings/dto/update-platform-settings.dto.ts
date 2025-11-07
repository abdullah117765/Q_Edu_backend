import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional({
    description: 'Platform session timeout in minutes',
    minimum: 5,
    maximum: 480,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  sessionTimeoutMinutes?: number;

  @ApiPropertyOptional({
    description: 'Threshold (credits) that triggers low balance alerts',
    minimum: 0,
    maximum: 10000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  zoomCreditLowThreshold?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of concurrent live classes allowed',
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxConcurrentClasses?: number;

  @ApiPropertyOptional({
    description: 'Send daily operational digest emails to admins',
  })
  @IsOptional()
  @IsBoolean()
  dailyDigestEmail?: boolean;

  @ApiPropertyOptional({ description: 'Primary support email shown to users' })
  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of academies a teacher can join (0 for unlimited)',
    minimum: 0,
    maximum: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  maxAcademiesPerTeacher?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of academies a student can join (0 for unlimited)',
    minimum: 0,
    maximum: 50,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(50)
  maxAcademiesPerStudent?: number;

  @ApiPropertyOptional({
    description: 'Enable host video when meetings start',
  })
  @IsOptional()
  @IsBoolean()
  zoomHostVideoEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Enable participant video when they join',
  })
  @IsOptional()
  @IsBoolean()
  zoomParticipantVideoEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Allow participants to join before host',
  })
  @IsOptional()
  @IsBoolean()
  zoomJoinBeforeHost?: boolean;

  @ApiPropertyOptional({
    description: 'Mute participants upon entry',
  })
  @IsOptional()
  @IsBoolean()
  zoomMuteUponEntry?: boolean;

  @ApiPropertyOptional({
    description: 'Enable waiting room for all meetings',
  })
  @IsOptional()
  @IsBoolean()
  zoomWaitingRoomEnabled?: boolean;

  @ApiPropertyOptional({
    description: 'Default automatic recording setting',
    enum: ['local', 'cloud', 'none'],
  })
  @IsOptional()
  @IsIn(['local', 'cloud', 'none'])
  zoomAutoRecordingMode?: 'local' | 'cloud' | 'none';

  @ApiPropertyOptional({
    description: 'Default audio option for meetings',
    enum: ['both', 'telephony', 'voip'],
  })
  @IsOptional()
  @IsIn(['both', 'telephony', 'voip'])
  zoomAudioType?: 'both' | 'telephony' | 'voip';

  @ApiPropertyOptional({
    description: 'Allow Zoom in-meeting chat for attendees',
  })
  @IsOptional()
  @IsBoolean()
  zoomChatEnabled?: boolean;
}

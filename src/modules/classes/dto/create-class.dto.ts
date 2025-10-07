import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { ClassParticipantRole } from '../entities/class-participant-role.enum';

class ZoomMeetingSettingsDto {
  @ApiPropertyOptional({ description: 'Enable host video on start' })
  @IsOptional()
  @IsBoolean()
  host_video?: boolean;

  @ApiPropertyOptional({ description: 'Enable participant video on join' })
  @IsOptional()
  @IsBoolean()
  participant_video?: boolean;

  @ApiPropertyOptional({ description: 'Allow participants to join before host' })
  @IsOptional()
  @IsBoolean()
  join_before_host?: boolean;

  @ApiPropertyOptional({ description: 'Mute participants upon entry' })
  @IsOptional()
  @IsBoolean()
  mute_upon_entry?: boolean;

  @ApiPropertyOptional({ description: 'Enable waiting room' })
  @IsOptional()
  @IsBoolean()
  waiting_room?: boolean;

  @ApiPropertyOptional({ description: 'Automatic recording setting', enum: ['local', 'cloud', 'none'] })
  @IsOptional()
  @IsString()
  auto_recording?: 'local' | 'cloud' | 'none';

  @ApiPropertyOptional({ description: 'Meeting audio options', enum: ['both', 'telephony', 'voip'] })
  @IsOptional()
  @IsString()
  audio?: 'both' | 'telephony' | 'voip';

  @ApiPropertyOptional({ description: 'Alternative hosts (comma separated emails)' })
  @IsOptional()
  @IsString()
  alternative_hosts?: string;
}

class CreateClassParticipantDto {
  @ApiPropertyOptional({ description: 'Internal user identifier when participant is registered in the platform' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Participant email address if external' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: 'Participant display name' })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiPropertyOptional({ enum: ClassParticipantRole, default: ClassParticipantRole.STUDENT })
  @IsOptional()
  @IsString()
  role?: ClassParticipantRole;
}

export class CreateClassDto {
  @ApiProperty({ description: 'Class title' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 150)
  title!: string;

  @ApiPropertyOptional({ description: 'Class description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Identifier of the teacher hosting the class' })
  @IsString()
  @IsNotEmpty()
  teacherId!: string;

  @ApiProperty({ description: 'Scheduled start date/time in ISO 8601 format' })
  @IsDateString()
  scheduledStart!: string;

  @ApiProperty({ description: 'Scheduled end date/time in ISO 8601 format' })
  @IsDateString()
  scheduledEnd!: string;

  @ApiProperty({ description: 'Timezone identifier (e.g., America/New_York)' })
  @IsString()
  @IsNotEmpty()
  timezone!: string;

  @ApiPropertyOptional({ description: 'Optional allocated credits for the class' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  creditsConsumed?: number;

  @ApiPropertyOptional({ type: () => ZoomMeetingSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ZoomMeetingSettingsDto)
  zoomSettings?: ZoomMeetingSettingsDto;

  @ApiPropertyOptional({ type: () => [CreateClassParticipantDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateClassParticipantDto)
  participants?: CreateClassParticipantDto[];

  @ApiPropertyOptional({ description: 'Structured metadata stored with the class', type: Object })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

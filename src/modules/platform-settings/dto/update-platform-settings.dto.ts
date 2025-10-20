import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdatePlatformSettingsDto {
  @ApiPropertyOptional({ description: 'Allow teachers to self-register accounts' })
  @IsOptional()
  @IsBoolean()
  allowTeacherSelfRegistration?: boolean;

  @ApiPropertyOptional({ description: 'Automatically approve newly registered students' })
  @IsOptional()
  @IsBoolean()
  autoApproveStudents?: boolean;

  @ApiPropertyOptional({ description: 'Platform session timeout in minutes', minimum: 5, maximum: 480 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  sessionTimeoutMinutes?: number;

  @ApiPropertyOptional({ description: 'Threshold (credits) that triggers low balance alerts', minimum: 0, maximum: 10000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10000)
  zoomCreditLowThreshold?: number;

  @ApiPropertyOptional({ description: 'Maximum number of concurrent live classes allowed', minimum: 1, maximum: 1000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  maxConcurrentClasses?: number;

  @ApiPropertyOptional({ description: 'Send daily operational digest emails to admins' })
  @IsOptional()
  @IsBoolean()
  dailyDigestEmail?: boolean;

  @ApiPropertyOptional({ description: 'Primary support email shown to users' })
  @IsOptional()
  @IsEmail()
  supportEmail?: string;
}

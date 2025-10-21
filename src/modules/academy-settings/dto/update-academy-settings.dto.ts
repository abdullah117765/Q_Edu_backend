import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateAcademySettingsDto {
  @ApiPropertyOptional({
    description: 'Allow teachers attached to the academy to self-register',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  allowTeacherSelfRegistration?: boolean;

  @ApiPropertyOptional({
    description: 'Automatically approve new student registrations',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  autoApproveStudents?: boolean;

  @ApiPropertyOptional({
    description:
      'Send notifications to the academy owner when new users register',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  notifyOwnerOnNewRegistration?: boolean;

  @ApiPropertyOptional({
    description: 'Require generated Zoom meetings to include passwords',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  requireZoomPassword?: boolean;

  @ApiPropertyOptional({
    description: 'Default duration for newly scheduled classes in minutes',
    minimum: 15,
    maximum: 360,
    example: 60,
  })
  @IsOptional()
  @IsInt()
  @Min(15)
  @Max(360)
  defaultClassDurationMinutes?: number;
}

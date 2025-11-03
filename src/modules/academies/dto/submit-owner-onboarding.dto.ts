import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class SubmitOwnerOnboardingDto {
  @ApiProperty({
    description: 'Display name for the academy profile',
    minLength: 3,
    maxLength: 120,
  })
  @IsString()
  @Length(3, 120)
  name!: string;

  @ApiPropertyOptional({
    description: 'Overview of the academy mission, offerings, or differentiators',
    maxLength: 512,
  })
  @IsString()
  @Length(0, 512)
  description?: string;
}

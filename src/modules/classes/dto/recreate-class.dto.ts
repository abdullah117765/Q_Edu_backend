import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class RecreateClassDto {
  @ApiPropertyOptional({
    description:
      'New scheduled start time (ISO 8601). Defaults to original start time.',
  })
  @IsOptional()
  @IsDateString()
  scheduledStart?: string;

  @ApiPropertyOptional({
    description:
      'New scheduled end time (ISO 8601). Defaults to original end time.',
  })
  @IsOptional()
  @IsDateString()
  scheduledEnd?: string;
}

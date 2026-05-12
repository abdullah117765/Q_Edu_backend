import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateRecordingDto {
  @ApiProperty({ description: 'The class ID this recording belongs to' })
  @IsString()
  classId: string;

  @ApiProperty({ enum: ['ZOOM_CLOUD', 'ZOOM_LOCAL'] })
  @IsIn(['ZOOM_CLOUD', 'ZOOM_LOCAL'])
  source: 'ZOOM_CLOUD' | 'ZOOM_LOCAL';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  playUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl()
  downloadUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  password?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  topic?: string;
}

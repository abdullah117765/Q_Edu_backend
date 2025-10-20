import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceVisibility } from '@prisma/client';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, IsInt, Min } from 'class-validator';

export class CreateResourceDto {
  @ApiProperty({ description: 'Title of the resource', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({ description: 'Short description of the resource', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ description: 'Storage key used by the file service', maxLength: 512 })
  @IsString()
  @MaxLength(512)
  fileKey!: string;

  @ApiProperty({ description: 'Publicly accessible URL for the resource' })
  @IsUrl()
  fileUrl!: string;

  @ApiPropertyOptional({ description: 'Mime type of the uploaded file', example: 'application/pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  mimeType?: string;

  @ApiPropertyOptional({ description: 'Category/type of the file', example: 'pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  fileType?: string;

  @ApiPropertyOptional({ description: 'File size in bytes', example: 1048576 })
  @IsOptional()
  @IsInt()
  @Min(0)
  fileSize?: number;

  @ApiPropertyOptional({ description: 'Associated class identifier' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  classId?: string;

  @ApiPropertyOptional({ enum: ResourceVisibility, default: ResourceVisibility.ACADEMY })
  @IsOptional()
  @IsEnum(ResourceVisibility)
  visibility?: ResourceVisibility;

  @ApiPropertyOptional({ description: 'Additional metadata for the resource' })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

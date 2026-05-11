import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceVisibility } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateUploadedResourceDto {
  @ApiProperty({ description: 'Title of the resource', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiPropertyOptional({
    description: 'Short description of the resource',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: 'Category/type of the file', example: 'pdf' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  fileType?: string;

  @ApiPropertyOptional({ description: 'Associated class identifier' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  classId?: string;

  @ApiProperty({ description: 'Identifier of the academy that owns this resource' })
  @IsString()
  @MaxLength(64)
  academyId!: string;

  @ApiPropertyOptional({
    enum: ResourceVisibility,
    default: ResourceVisibility.ACADEMY,
  })
  @IsOptional()
  @IsEnum(ResourceVisibility)
  visibility?: ResourceVisibility;
}

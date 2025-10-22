import { ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceVisibility } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ResourcesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search term applied to title/description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by file type', example: 'pdf' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Filter by associated class id' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ description: 'Filter by uploader id' })
  @IsOptional()
  @IsString()
  uploaderId?: string;

  @ApiPropertyOptional({ enum: ResourceVisibility })
  @IsOptional()
  @IsEnum(ResourceVisibility)
  visibility?: ResourceVisibility;

  @ApiPropertyOptional({ description: 'Filter by academy identifier' })
  @IsOptional()
  @IsString()
  academyId?: string;
}

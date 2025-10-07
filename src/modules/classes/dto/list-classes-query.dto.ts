import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClassStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListClassesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ClassStatus, description: 'Filter by class status' })
  @IsOptional()
  @IsEnum(ClassStatus)
  status?: ClassStatus;

  @ApiPropertyOptional({ description: 'Filter by teacher identifier' })
  @IsOptional()
  @IsString()
  teacherId?: string;

  @ApiPropertyOptional({ description: 'Search term applied to title and description' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'ISO date filter for start time (inclusive)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date filter for end time (inclusive)' })
  @IsOptional()
  @IsDateString()
  to?: string;
}

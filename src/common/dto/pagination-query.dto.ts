import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Page number (1-indexed)', minimum: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : 1))
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, maximum: 100, default: 25 })
  @IsOptional()
  @Transform(({ value }) => (value !== undefined ? Number(value) : 25))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 25;
}
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AcademyStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class AdminAcademyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: AcademyStatus,
    description: 'Filter academies by approval status',
  })
  @IsOptional()
  @IsEnum(AcademyStatus)
  status?: AcademyStatus;

  @ApiPropertyOptional({
    description: 'Search by academy name, slug, description, or owner email',
    minLength: 2,
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  search?: string;
}

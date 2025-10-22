import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class AcademyDirectoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter academies by name, description, or slug',
    minLength: 2,
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @Length(2, 120)
  search?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ClassParticipantsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by participant name or email' })
  @IsOptional()
  @IsString()
  search?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { AcademyMembershipStatus } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class AcademyMembershipQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AcademyMembershipStatus, description: 'Filter by membership status' })
  @IsOptional()
  @IsEnum(AcademyMembershipStatus)
  status?: AcademyMembershipStatus;
}

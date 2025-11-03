import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { UserStatus } from '../entities/user-status.enum';

export class TeachersQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UserStatus, description: 'Filter teachers by onboarding status' })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Search teachers by name or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter teachers who belong to a specific academy' })
  @IsOptional()
  @IsString()
  academyId?: string;
}

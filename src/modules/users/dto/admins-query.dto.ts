import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { UserStatus } from '../entities/user-status.enum';

export class AdminsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: UserStatus, description: 'Filter admins by onboarding status' })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Search admins by name or email' })
  @IsOptional()
  @IsString()
  search?: string;
}

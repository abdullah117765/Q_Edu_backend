import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { Role } from '../entities/role.enum';
import { UserStatus } from '../entities/user-status.enum';

export class UsersDirectoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: Role,
    description:
      'Filter users by role (SUPER_ADMIN is intentionally excluded from directory results)',
  })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    enum: UserStatus,
    description: 'Filter users by approval status',
  })
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Search users by name or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter users by academy id' })
  @IsOptional()
  @IsString()
  academyId?: string;

  @ApiPropertyOptional({ description: 'Filter users by academy owner id' })
  @IsOptional()
  @IsString()
  ownerId?: string;
}

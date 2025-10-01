import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { Role } from '../entities/role.enum';

const PHONE_REGEX = /^[0-9+()\-\s]{7,20}$/;

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: '+1 555 123 4567', pattern: PHONE_REGEX.source })
  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, { message: 'phoneNumber must contain only digits, spaces, and valid symbols' })
  phoneNumber?: string;

  @ApiPropertyOptional({ enum: Role })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({ description: 'Whether the account is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
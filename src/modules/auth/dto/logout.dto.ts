import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class LogoutDto {
  @ApiPropertyOptional({ description: 'Refresh token to revoke; omit to revoke all tokens for the user' })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
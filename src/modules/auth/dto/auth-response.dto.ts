import { ApiProperty } from '@nestjs/swagger';
import { UserEntity } from '../../users/entities/user.entity';

export class AuthResponseDto {
  @ApiProperty({ description: 'Bearer token for authenticated requests' })
  accessToken!: string;

  @ApiProperty({ description: 'Refresh token used to obtain new access tokens' })
  refreshToken!: string;

  @ApiProperty({ type: () => UserEntity })
  user!: UserEntity;
}
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ minLength: 8, example: 'Curr3ntP@ss' })
  @IsString()
  @MinLength(8)
  currentPassword!: string;

  @ApiProperty({ minLength: 8, example: 'N3wStr0ngP@ss' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
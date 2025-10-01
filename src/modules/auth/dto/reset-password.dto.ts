import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

const OTP_REGEX = /^[0-9]{6}$/;

export class ResetPasswordDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', description: 'Six digit OTP sent to the registered email' })
  @IsString()
  @Matches(OTP_REGEX, { message: 'OTP must be a 6 digit code' })
  otp!: string;

  @ApiProperty({ minLength: 8, example: 'N3wStr0ngP@ss' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches } from 'class-validator';

const OTP_REGEX = /^[0-9]{6}$/;

export class VerifyRegistrationOtpDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456', description: 'Six digit verification code sent via email' })
  @IsString()
  @Matches(OTP_REGEX, { message: 'OTP must be a 6 digit code' })
  otp!: string;
}
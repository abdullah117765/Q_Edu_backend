import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { PHONE_REGEX } from './phone-regex.constant';

export class CreateTeacherDto {
  @ApiProperty({ example: 'teacher@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'Str0ngP@ssword' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Taylor' })
  @IsString()
  firstName!: string;

  @ApiPropertyOptional({ example: 'Anderson' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    example: '+1 555 123 4567',
    pattern: PHONE_REGEX.source,
    description: 'Teacher contact number',
  })
  @IsString()
  @Matches(PHONE_REGEX, { message: 'phoneNumber must contain only digits, spaces, and valid symbols' })
  phoneNumber!: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { Role } from '../entities/role.enum';

const PHONE_REGEX = /^[0-9+()\-\s]{7,20}$/;

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: 'Str0ngP@ssword' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Jane' })
  @IsString()
  firstName!: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({
    example: '+1 555 123 4567',
    pattern: PHONE_REGEX.source,
    description: 'Contact number for account verification',
  })
  @IsString()
  @Matches(PHONE_REGEX, { message: 'phoneNumber must contain only digits, spaces, and valid symbols' })
  phoneNumber!: string;

  @ApiPropertyOptional({ enum: Role, description: 'Role assigned to the user' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
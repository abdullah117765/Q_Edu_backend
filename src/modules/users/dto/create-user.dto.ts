import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
    IsEmail,
    IsEnum,
    IsOptional,
    IsString,
    Length,
    Matches,
    MaxLength,
    MinLength,
} from 'class-validator';
import { NoEmoji } from '../../../common/validators/no-emoji.validator';
import { Role } from '../entities/role.enum';
import { PHONE_REGEX } from './phone-regex.constant';

export class CreateUserDto {
  @ApiProperty({ example: 'user@example.com', maxLength: 254 })
  @IsEmail()
  @MaxLength(254)
  @NoEmoji()
  email!: string;

  @ApiProperty({ minLength: 8, maxLength: 128, example: 'Str0ngP@ssword' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Jane', maxLength: 80 })
  @IsString()
  @Length(1, 80)
  @NoEmoji()
  firstName!: string;

  @ApiPropertyOptional({ example: 'Doe', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @NoEmoji()
  lastName?: string;

  @ApiProperty({
    example: '+1 555 123 4567',
    pattern: PHONE_REGEX.source,
    description: 'Contact number for account verification',
    maxLength: 32,
  })
  @IsString()
  @MaxLength(32)
  @Matches(PHONE_REGEX, {
    message: 'phoneNumber must contain only digits, spaces, and valid symbols',
  })
  @NoEmoji()
  phoneNumber!: string;

  @ApiPropertyOptional({ enum: Role, description: 'Role assigned to the user' })
  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @ApiPropertyOptional({
    example: 'Bright Minds Academy',
    description: 'Required when role is ACADEMY_OWNER',
    minLength: 3,
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @Length(3, 120)
  academyName?: string;

  @ApiPropertyOptional({
    example: 'A collaborative learning space focused on STEM excellence.',
    maxLength: 512,
  })
  @IsOptional()
  @IsString()
  @Length(0, 512)
  academyDescription?: string;
}

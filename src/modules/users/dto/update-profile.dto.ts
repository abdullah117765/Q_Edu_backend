import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { NoEmoji } from '../../../common/validators/no-emoji.validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Taylor', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @NoEmoji()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Rivera', maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  @NoEmoji()
  lastName?: string;

  @ApiPropertyOptional({ example: '+1 555 0100 200', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @NoEmoji()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'Non-binary', maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @NoEmoji()
  gender?: string;

  @ApiPropertyOptional({
    example: 'Passionate educator who loves gamified learning.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ example: '2001-05-25' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'Sunset Boulevard' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressStreet?: string;

  @ApiPropertyOptional({ example: '42B' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  addressHouse?: string;

  @ApiPropertyOptional({ example: 'Emerald City' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  addressCity?: string;

  @ApiPropertyOptional({ example: 'Oz State' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  addressState?: string;

  @ApiPropertyOptional({ example: 'Wonderland' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  addressCountry?: string;
}

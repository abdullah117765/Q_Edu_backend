import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Taylor' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Rivera' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ example: '+1 555 0100 200' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'Non-binary unicorn' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  gender?: string;

  @ApiPropertyOptional({ example: 'Passionate educator who loves gamified learning.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
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

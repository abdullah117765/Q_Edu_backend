import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContactMessageStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateContactMessageStatusDto {
  @ApiProperty({ enum: ContactMessageStatus })
  @IsEnum(ContactMessageStatus)
  status!: ContactMessageStatus;

  @ApiPropertyOptional({ description: 'Optional triage note' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

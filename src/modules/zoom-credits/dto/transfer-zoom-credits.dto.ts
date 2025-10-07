import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, IsObject } from 'class-validator';

export class TransferZoomCreditsDto {
  @ApiProperty({ description: 'User initiating the transfer (credits will be deducted from this account)' })
  @IsString()
  @IsNotEmpty()
  fromUserId!: string;

  @ApiProperty({ description: 'Recipient of the credits' })
  @IsString()
  @IsNotEmpty()
  toUserId!: string;

  @ApiProperty({ description: 'Credits to transfer', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ description: 'Optional reason or context for the transfer' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Additional metadata saved in audit logs', type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

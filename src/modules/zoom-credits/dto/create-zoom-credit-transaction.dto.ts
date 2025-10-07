import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsPositive, IsString, IsUUID, ValidateIf, IsObject } from 'class-validator';

export enum ZoomCreditOperation {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export class CreateZoomCreditTransactionDto {
  @ApiProperty({ description: 'Identifier of the user whose balance will be adjusted' })
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ enum: ZoomCreditOperation })
  @IsEnum(ZoomCreditOperation)
  operation!: ZoomCreditOperation;

  @ApiProperty({ description: 'Number of credits to adjust', minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ description: 'Optional reason for the adjustment' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'Optional class identifier linked to the adjustment' })
  @IsOptional()
  @IsString()
  classId?: string;

  @ApiPropertyOptional({ description: 'Structured metadata for audit purposes', type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

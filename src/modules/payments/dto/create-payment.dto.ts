import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDecimal, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export class CreatePaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ description: 'Payment amount in major units', example: '99.99' })
  @IsDecimal()
  amount!: string;

  @ApiProperty({ default: 'USD' })
  @IsString()
  @MaxLength(8)
  currency!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  provider!: string;

  @ApiProperty({ enum: PaymentStatus, default: PaymentStatus.PENDING })
  @IsString()
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  reference?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  metadata?: Record<string, unknown>;
}

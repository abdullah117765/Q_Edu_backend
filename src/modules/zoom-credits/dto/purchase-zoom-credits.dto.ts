import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class PurchaseZoomCreditsDto {
  @ApiProperty({ description: 'Number of credits to purchase', example: 250 })
  @IsInt()
  @IsPositive()
  amount!: number;

  @ApiPropertyOptional({ description: 'Identifier of the selected purchase plan', example: 'standard' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  planId?: string;

  @ApiPropertyOptional({ description: 'Currency for the purchase', example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  currency?: string;

  @ApiPropertyOptional({ description: 'Optional external payment reference', example: 'PAY-83FHS8' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  paymentReference?: string;
}

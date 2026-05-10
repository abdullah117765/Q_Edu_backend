import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
    CouponAppliesTo,
    CouponDiscountType,
    CouponDuration,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsDateString,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Length,
    Max,
    Min,
} from 'class-validator';

export class CreateCouponDto {
  @ApiProperty({ example: 'LAUNCH25', maxLength: 32 })
  @IsString()
  @Length(2, 32)
  code!: string;

  @ApiProperty({ example: 'Launch promo 25% off', maxLength: 80 })
  @IsString()
  @Length(2, 80)
  name!: string;

  @ApiPropertyOptional({ maxLength: 280 })
  @IsOptional()
  @IsString()
  @Length(0, 280)
  description?: string;

  @ApiProperty({ enum: CouponDiscountType })
  @IsEnum(CouponDiscountType)
  discountType!: CouponDiscountType;

  @ApiPropertyOptional({
    description: 'Required when discountType=PERCENT, 1-100',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  percentOff?: number;

  @ApiPropertyOptional({
    description: 'Required when discountType=AMOUNT, in minor units (cents)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountOffCents?: number;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ enum: CouponDuration, default: CouponDuration.ONCE })
  @IsOptional()
  @IsEnum(CouponDuration)
  duration?: CouponDuration;

  @ApiPropertyOptional({ description: 'Required when duration=REPEATING' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  durationMonths?: number;

  @ApiPropertyOptional({ enum: CouponAppliesTo, default: CouponAppliesTo.ALL })
  @IsOptional()
  @IsEnum(CouponAppliesTo)
  appliesTo?: CouponAppliesTo;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @ApiPropertyOptional({
    description: 'ISO date when the coupon becomes valid',
  })
  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'ISO date when the coupon expires' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  highlight?: boolean;

  @ApiPropertyOptional({
    description: 'Title shown to academy owners on the marketing banner',
  })
  @IsOptional()
  @IsString()
  @Length(0, 80)
  marketingTitle?: string;

  @ApiPropertyOptional({
    description: 'Body text shown alongside the marketing banner',
  })
  @IsOptional()
  @IsString()
  @Length(0, 280)
  marketingBody?: string;
}

export class UpdateCouponDto extends PartialType(CreateCouponDto) {}

export class ApplyCouponDto {
  @ApiProperty({ example: 'LAUNCH25' })
  @IsString()
  @Length(2, 32)
  code!: string;
}

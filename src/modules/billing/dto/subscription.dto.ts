import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { SubscriptionInterval } from '@prisma/client';
import { Type } from 'class-transformer';
import {
    IsBoolean,
    IsEnum,
    IsInt,
    IsOptional,
    IsString,
    Length,
    Max,
    Min,
} from 'class-validator';

export class CreateSubscriptionPlanDto {
  @ApiProperty({ example: 'Pro Academy', maxLength: 80 })
  @IsString()
  @Length(2, 80)
  name!: string;

  @ApiPropertyOptional({ maxLength: 280 })
  @IsOptional()
  @IsString()
  @Length(0, 280)
  description?: string;

  @ApiProperty({
    example: 'pro',
    description: 'Tier slug (free, pro, scale)',
    maxLength: 32,
  })
  @IsString()
  @Length(2, 32)
  tier!: string;

  @ApiProperty({ example: 2900, description: 'Price in cents per interval' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceCents!: number;

  @ApiPropertyOptional({ example: 'usd' })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    enum: SubscriptionInterval,
    default: SubscriptionInterval.MONTHLY,
  })
  @IsOptional()
  @IsEnum(SubscriptionInterval)
  interval?: SubscriptionInterval;

  @ApiPropertyOptional({ description: 'Included class minutes per period' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  monthlyClassMinutes?: number;

  @ApiPropertyOptional({ description: 'Included credits per period' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  monthlyCredits?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxTeachers?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxStudents?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  highlight?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateSubscriptionPlanDto extends PartialType(
  CreateSubscriptionPlanDto,
) {}

export class StartCheckoutDto {
  @ApiProperty({
    example: 'pkg_starter',
    description: 'ZoomCreditPackage id or SubscriptionPlan id',
  })
  @IsString()
  @Length(1, 64)
  id!: string;

  @ApiPropertyOptional({
    description: 'Optional quantity multiplier (one-time only)',
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  quantity?: number;

  @ApiPropertyOptional({
    description: 'Optional override redirect URL on success',
  })
  @IsOptional()
  @IsString()
  successUrl?: string;

  @ApiPropertyOptional({
    description: 'Optional override redirect URL on cancel',
  })
  @IsOptional()
  @IsString()
  cancelUrl?: string;

  @ApiPropertyOptional({ description: 'Optional coupon/promotion code' })
  @IsOptional()
  @IsString()
  @Length(2, 32)
  couponCode?: string;
}

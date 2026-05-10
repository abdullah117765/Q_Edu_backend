import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { ZoomCreditPackageBillingType } from '@prisma/client';

export class CreatePackageDto {
  @ApiProperty({ example: 'Starter', maxLength: 80 })
  @IsString()
  @Length(2, 80)
  name!: string;

  @ApiPropertyOptional({ example: 'Best for trying it out.', maxLength: 280 })
  @IsOptional()
  @IsString()
  @Length(0, 280)
  description?: string;

  @ApiProperty({ example: 100, minimum: 1, description: 'Number of credits granted' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  credits!: number;

  @ApiProperty({ example: 1000, description: 'Price in the smallest currency unit (cents)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100_000_000)
  priceCents!: number;

  @ApiPropertyOptional({ example: 'usd', minLength: 3, maxLength: 3 })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({ enum: ZoomCreditPackageBillingType })
  @IsOptional()
  @IsEnum(ZoomCreditPackageBillingType)
  billingType?: ZoomCreditPackageBillingType;

  @ApiPropertyOptional({ example: 0, minimum: 0, description: 'Bonus credits added on top' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  bonusCredits?: number;

  @ApiPropertyOptional({ description: 'Mark as featured / highlighted' })
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
  @Max(10_000)
  sortOrder?: number;
}

export class UpdatePackageDto extends PartialType(CreatePackageDto) {}

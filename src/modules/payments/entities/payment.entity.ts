import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PaymentEntity {
  constructor(partial: Partial<PaymentEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  amount!: number;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  reference?: string | null;

  @ApiPropertyOptional({ type: Object })
  metadata?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  userName?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

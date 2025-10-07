import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ZoomCreditTransactionType } from '@prisma/client';

export class ZoomCreditTransactionEntity {
  constructor(partial: Partial<ZoomCreditTransactionEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ example: 'trxn_123' })
  id!: string;

  @ApiProperty({ example: 'user_123' })
  userId!: string;

  @ApiPropertyOptional({ example: 'user_456' })
  relatedUserId?: string | null;

  @ApiPropertyOptional({ example: 'class_123' })
  classId?: string | null;

  @ApiProperty({ enum: ZoomCreditTransactionType, example: ZoomCreditTransactionType.CREDIT })
  type!: ZoomCreditTransactionType;

  @ApiProperty({ example: 50 })
  amount!: number;

  @ApiProperty({ example: 150, description: 'Balance after the transaction' })
  runningBalance!: number;

  @ApiPropertyOptional({ example: 'Monthly credit allocation' })
  reason?: string | null;

  @ApiPropertyOptional({ type: Object })
  metadata?: Record<string, unknown> | null;

  @ApiProperty({ example: '2025-01-01T12:00:00.000Z' })
  createdAt!: Date;
}

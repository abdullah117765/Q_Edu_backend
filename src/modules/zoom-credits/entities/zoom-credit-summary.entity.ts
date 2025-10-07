import { ApiProperty } from '@nestjs/swagger';

export class ZoomCreditSummaryEntity {
  constructor(partial: Partial<ZoomCreditSummaryEntity>) {
    Object.assign(this, partial);
  }

  @ApiProperty({ example: 'user_123' })
  userId!: string;

  @ApiProperty({ example: 500, description: 'Total credits ever allocated to the user' })
  totalCredited!: number;

  @ApiProperty({ example: 200, description: 'Total credits consumed or transferred out' })
  totalDebited!: number;

  @ApiProperty({ example: 300, description: 'Current available balance' })
  balance!: number;

  @ApiProperty({ example: '2025-01-05T09:30:00.000Z' })
  updatedAt!: Date;
}

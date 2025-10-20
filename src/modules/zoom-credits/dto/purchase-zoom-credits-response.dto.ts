import { ApiProperty } from '@nestjs/swagger';
import { ZoomCreditSummaryEntity } from '../entities/zoom-credit-summary.entity';
import { ZoomCreditTransactionEntity } from '../entities/zoom-credit-transaction.entity';

export class PurchaseZoomCreditsResponseDto {
  @ApiProperty({ type: () => ZoomCreditSummaryEntity })
  summary!: ZoomCreditSummaryEntity;

  @ApiProperty({ type: () => ZoomCreditTransactionEntity })
  transaction!: ZoomCreditTransactionEntity;
}

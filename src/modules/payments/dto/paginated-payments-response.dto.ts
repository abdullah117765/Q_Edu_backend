import { ApiProperty } from '@nestjs/swagger';
import { PaginationMeta } from '../../../common/interfaces/pagination.interface';
import { PaymentEntity } from '../entities/payment.entity';

class PaymentsPaginationMeta implements PaginationMeta {
  @ApiProperty()
  total!: number;

  @ApiProperty()
  count!: number;

  @ApiProperty()
  currentPage!: number;

  @ApiProperty()
  totalPages!: number;

  @ApiProperty({ nullable: true })
  nextPage!: number | null;

  @ApiProperty({ nullable: true })
  previousPage!: number | null;
}

class PaymentStatusAggregateDto {
  @ApiProperty({ description: 'Payment status value', example: 'COMPLETED' })
  status!: string;

  @ApiProperty({ description: 'Number of payments with this status', example: 12 })
  count!: number;

  @ApiProperty({ description: 'Total amount for this status', example: 2499.5 })
  amount!: number;
}

class PaymentsSummaryDto {
  @ApiProperty({ description: 'Aggregated amount across all matching payments', example: 5489.75 })
  totalAmount!: number;

  @ApiProperty({ description: 'Total number of payments that match the filters', example: 42 })
  totalCount!: number;

  @ApiProperty({ type: () => [PaymentStatusAggregateDto], description: 'Breakdown of payments grouped by status' })
  byStatus!: PaymentStatusAggregateDto[];
}

export class PaginatedPaymentsResponseDto {
  @ApiProperty({ type: () => [PaymentEntity] })
  data!: PaymentEntity[];

  @ApiProperty({ type: () => PaymentsPaginationMeta })
  meta!: PaymentsPaginationMeta;

  @ApiProperty({ type: () => PaymentsSummaryDto })
  summary!: PaymentsSummaryDto;
}

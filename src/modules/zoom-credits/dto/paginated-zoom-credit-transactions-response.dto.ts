import { ApiProperty } from '@nestjs/swagger';
import { ZoomCreditTransactionEntity } from '../entities/zoom-credit-transaction.entity';

class PaginationMetaDto {
  @ApiProperty({ description: 'Total records matching the query' })
  total!: number;

  @ApiProperty({ description: 'Returned records count in current page' })
  count!: number;

  @ApiProperty({ description: 'Current page number (1-indexed)' })
  currentPage!: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages!: number;

  @ApiProperty({ nullable: true, description: 'Next page number when available' })
  nextPage!: number | null;

  @ApiProperty({ nullable: true, description: 'Previous page number when available' })
  previousPage!: number | null;
}

export class PaginatedZoomCreditTransactionsResponseDto {
  @ApiProperty({ type: () => [ZoomCreditTransactionEntity] })
  data!: ZoomCreditTransactionEntity[];

  @ApiProperty({ type: () => PaginationMetaDto })
  meta!: PaginationMetaDto;
}

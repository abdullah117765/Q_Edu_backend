import { ApiPropertyOptional } from '@nestjs/swagger';
import { ZoomCreditTransactionType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ZoomCreditTransactionsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ZoomCreditTransactionType, description: 'Filter transactions by type' })
  @IsOptional()
  @IsEnum(ZoomCreditTransactionType)
  type?: ZoomCreditTransactionType;
}

import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { Auth } from '../../common/decorators/auth.decorator';
import { Role } from '../users/entities/role.enum';
import { CreateZoomCreditTransactionDto } from './dto/create-zoom-credit-transaction.dto';
import { PaginatedZoomCreditTransactionsResponseDto } from './dto/paginated-zoom-credit-transactions-response.dto';
import { TransferZoomCreditsDto } from './dto/transfer-zoom-credits.dto';
import { ZoomCreditTransactionsQueryDto } from './dto/zoom-credit-transactions-query.dto';
import { ZoomCreditSummaryEntity } from './entities/zoom-credit-summary.entity';
import { ZoomCreditTransactionEntity } from './entities/zoom-credit-transaction.entity';
import { ZoomCreditsService } from './zoom-credits.service';
import { PurchaseZoomCreditsDto } from './dto/purchase-zoom-credits.dto';
import { PurchaseZoomCreditsResponseDto } from './dto/purchase-zoom-credits-response.dto';
type RequestWithUser = Request & { user?: { id?: string } };

@ApiTags('zoom-credits')
@ApiBearerAuth()
@Controller('zoom-credits')
export class ZoomCreditsController {
  constructor(private readonly zoomCreditsService: ZoomCreditsService) {}

  @Post('transactions')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'Create a credit or debit transaction for a user' })
  async createTransaction(
    @Body() dto: CreateZoomCreditTransactionDto,
    @Req() request: Request,
  ): Promise<ZoomCreditTransactionEntity> {
    const actorId = (request as RequestWithUser).user?.id;
    return this.zoomCreditsService.adjustCredits(dto, actorId);
  }

  @Post('transfer')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'Transfer credits between two users' })
  async transfer(
    @Body() dto: TransferZoomCreditsDto,
    @Req() request: Request,
  ): Promise<{ outbound: ZoomCreditTransactionEntity; inbound: ZoomCreditTransactionEntity }> {
    const actorId = (request as RequestWithUser).user?.id;
    return this.zoomCreditsService.transferCredits(dto, actorId);
  }

  @Post('purchase')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({ summary: 'Purchase credits for the authenticated academy owner (mocked payment flow)' })
  async purchase(
    @Req() request: Request,
    @Body() dto: PurchaseZoomCreditsDto,
  ): Promise<PurchaseZoomCreditsResponseDto> {
    const userId = (request as RequestWithUser).user?.id;
    return this.zoomCreditsService.purchaseCredits(userId as string, dto);
  }

  @Get(':userId/summary')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'Fetch credit summary for a user' })
  @ApiParam({ name: 'userId', description: 'User identifier' })
  async getSummary(@Param('userId') userId: string): Promise<ZoomCreditSummaryEntity> {
    return this.zoomCreditsService.getSummary(userId);
  }

  @Get(':userId/transactions')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'Fetch paginated transaction history for a user' })
  @ApiParam({ name: 'userId', description: 'User identifier' })
  async getTransactions(
    @Param('userId') userId: string,
    @Query() query: ZoomCreditTransactionsQueryDto,
  ): Promise<PaginatedZoomCreditTransactionsResponseDto> {
    return this.zoomCreditsService.getTransactions(userId, query);
  }
}

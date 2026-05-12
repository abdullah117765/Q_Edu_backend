import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    Req,
} from '@nestjs/common';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { Auth } from '../../common/decorators/auth.decorator';
import { Role } from '../users/entities/role.enum';
import { CreateZoomCreditTransactionDto } from './dto/create-zoom-credit-transaction.dto';
import { PaginatedZoomCreditTransactionsResponseDto } from './dto/paginated-zoom-credit-transactions-response.dto';
import { PurchaseZoomCreditsResponseDto } from './dto/purchase-zoom-credits-response.dto';
import { PurchaseZoomCreditsDto } from './dto/purchase-zoom-credits.dto';
import { TransferZoomCreditsDto } from './dto/transfer-zoom-credits.dto';
import { ZoomCreditTransactionsQueryDto } from './dto/zoom-credit-transactions-query.dto';
import { ZoomCreditSummaryEntity } from './entities/zoom-credit-summary.entity';
import { ZoomCreditTransactionEntity } from './entities/zoom-credit-transaction.entity';
import { ZoomCreditsService } from './zoom-credits.service';
type RequestWithUser = Request & {
  user?: { id?: string; role?: string; academyId?: string };
};

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
  ): Promise<{
    outbound: ZoomCreditTransactionEntity;
    inbound: ZoomCreditTransactionEntity;
  }> {
    const actorId = (request as RequestWithUser).user?.id;
    return this.zoomCreditsService.transferCredits(dto, actorId);
  }

  @Post('purchase')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER)
  @ApiOperation({
    summary:
      'Purchase credits for the authenticated academy owner (mocked payment flow)',
  })
  async purchase(
    @Req() request: Request,
    @Body() dto: PurchaseZoomCreditsDto,
  ): Promise<PurchaseZoomCreditsResponseDto> {
    const userId = (request as RequestWithUser).user?.id;
    return this.zoomCreditsService.purchaseCredits(userId as string, dto);
  }

  @Get('me/summary')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'Fetch credit summary for the authenticated user' })
  async getMySummary(
    @Req() request: Request,
  ): Promise<ZoomCreditSummaryEntity> {
    const userId = (request as RequestWithUser).user?.id as string;
    return this.zoomCreditsService.getSummary(userId);
  }

  @Get(':userId/summary')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({ summary: 'Fetch credit summary for a user' })
  @ApiParam({ name: 'userId', description: 'User identifier' })
  async getSummary(
    @Param('userId') userId: string,
  ): Promise<ZoomCreditSummaryEntity> {
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

  @Get('me/usage-trend')
  @Auth(Role.SUPER_ADMIN, Role.ACADEMY_OWNER, Role.TEACHER)
  @ApiOperation({
    summary: 'Daily credit usage trend for the authenticated user',
  })
  async getMyUsageTrend(@Req() request: Request, @Query('days') days?: string) {
    const userId = (request as RequestWithUser).user?.id as string;
    return this.zoomCreditsService.getUsageTrend(
      userId,
      days ? Number(days) : 30,
    );
  }

  @Get('academy/:academyId/teachers-summary')
  @Auth(Role.ACADEMY_OWNER)
  @ApiOperation({
    summary: 'Get credit summary for all teachers in an academy',
  })
  @ApiParam({ name: 'academyId', description: 'Academy identifier' })
  async getAcademyTeachersCreditSummary(
    @Param('academyId') academyId: string,
    @Req() request: Request,
  ) {
    const ownerId = (request as RequestWithUser).user?.id as string;
    return this.zoomCreditsService.getAcademyTeachersCreditSummary(
      academyId,
      ownerId,
    );
  }

  @Patch('teacher/:teacherId/limit')
  @Auth(Role.ACADEMY_OWNER)
  @ApiOperation({
    summary: 'Set or update credit limit for a teacher',
  })
  @ApiParam({ name: 'teacherId', description: 'Teacher user identifier' })
  async setTeacherCreditLimit(
    @Param('teacherId') teacherId: string,
    @Body() dto: { academyId: string; limit: number | null; reason?: string },
    @Req() request: Request,
  ) {
    const actorId = (request as RequestWithUser).user?.id as string;
    await this.zoomCreditsService.setTeacherCreditLimit(
      teacherId,
      dto.academyId,
      dto.limit,
      actorId,
      dto.reason,
    );
    return { success: true, message: 'Credit limit updated successfully' };
  }

  @Post('teacher/:teacherId/assign')
  @Auth(Role.ACADEMY_OWNER)
  @ApiOperation({
    summary: 'Assign credits from academy owner balance to a teacher',
  })
  @ApiParam({ name: 'teacherId', description: 'Teacher user identifier' })
  async assignCreditsToTeacher(
    @Param('teacherId') teacherId: string,
    @Body() dto: { academyId: string; amount: number; reason?: string },
    @Req() request: Request,
  ) {
    const ownerId = (request as RequestWithUser).user?.id as string;
    await this.zoomCreditsService.assignCreditsToTeacher(
      teacherId,
      dto.academyId,
      dto.amount,
      ownerId,
      dto.reason,
    );
    return { success: true, message: 'Credits assigned successfully' };
  }

  @Get('teacher/:teacherId/audit-log')
  @Auth(Role.ACADEMY_OWNER, Role.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Get transaction and limit change audit log for a teacher',
  })
  @ApiParam({ name: 'teacherId', description: 'Teacher user identifier' })
  async getTeacherCreditAuditLog(
    @Param('teacherId') teacherId: string,
    @Query('academyId') academyId: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Req() request?: Request,
  ) {
    const ownerId = (request as RequestWithUser).user?.id as string;
    return this.zoomCreditsService.getTeacherCreditAuditLog(
      teacherId,
      academyId,
      ownerId,
      take ? Number(take) : 50,
      skip ? Number(skip) : 0,
      {
        type,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      },
    );
  }
}

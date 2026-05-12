import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    AcademyMemberRole,
    AcademyMembershipStatus,
    Prisma,
    ZoomCreditAuditAction,
    ZoomCreditTransaction,
    ZoomCreditTransactionType,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService } from '../payments/payments.service';
import {
    CreateZoomCreditTransactionDto,
    ZoomCreditOperation,
} from './dto/create-zoom-credit-transaction.dto';
import { PaginatedZoomCreditTransactionsResponseDto } from './dto/paginated-zoom-credit-transactions-response.dto';
import { PurchaseZoomCreditsResponseDto } from './dto/purchase-zoom-credits-response.dto';
import { PurchaseZoomCreditsDto } from './dto/purchase-zoom-credits.dto';
import { TransferZoomCreditsDto } from './dto/transfer-zoom-credits.dto';
import { ZoomCreditTransactionsQueryDto } from './dto/zoom-credit-transactions-query.dto';
import { ZoomCreditSummaryEntity } from './entities/zoom-credit-summary.entity';
import { ZoomCreditTransactionEntity } from './entities/zoom-credit-transaction.entity';

@Injectable()
export class ZoomCreditsService {
  private readonly logger = new Logger(ZoomCreditsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async adjustCredits(
    dto: CreateZoomCreditTransactionDto,
    actorId?: string,
  ): Promise<ZoomCreditTransactionEntity> {
    const type =
      dto.operation === ZoomCreditOperation.CREDIT
        ? ZoomCreditTransactionType.CREDIT
        : ZoomCreditTransactionType.DEBIT;

    const transaction = await this.prisma.$transaction(async (tx) => {
      const currentBalance = await this.ensureBalance(tx, dto.userId);

      const updatedBalance =
        type === ZoomCreditTransactionType.CREDIT
          ? currentBalance.balance + dto.amount
          : currentBalance.balance - dto.amount;

      if (updatedBalance < 0) {
        throw new BadRequestException(
          'Insufficient credits to complete this operation.',
        );
      }

      await tx.zoomCreditBalance.update({
        where: { userId: dto.userId },
        data: { balance: updatedBalance },
      });

      const createdTransaction = await tx.zoomCreditTransaction.create({
        data: {
          userId: dto.userId,
          type,
          amount: dto.amount,
          runningBalance: updatedBalance,
          reason: dto.reason,
          classId: dto.classId,
          metadata: this.toInputJson(dto.metadata),
        },
      });

      await tx.zoomCreditAuditLog.create({
        data: {
          transactionId: createdTransaction.id,
          actorId: actorId ?? null,
          action: ZoomCreditAuditAction.CREATED,
          details: this.toInputJson({
            reason: dto.reason,
            metadata: dto.metadata ?? null,
            classId: dto.classId ?? null,
            operation: dto.operation,
          }),
        },
      });

      return createdTransaction;
    });

    this.logger.log(
      `Processed ${type} zoom credit transaction of ${dto.amount} for user ${dto.userId}`,
    );
    return this.mapTransactionEntity(transaction);
  }

  async transferCredits(
    dto: TransferZoomCreditsDto,
    actorId?: string,
  ): Promise<{
    outbound: ZoomCreditTransactionEntity;
    inbound: ZoomCreditTransactionEntity;
  }> {
    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException(
        'Cannot transfer credits to the same user.',
      );
    }

    const { outbound, inbound } = await this.prisma.$transaction(async (tx) => {
      const originBalance = await this.ensureBalance(tx, dto.fromUserId);
      const destinationBalance = await this.ensureBalance(tx, dto.toUserId);

      if (originBalance.balance < dto.amount) {
        throw new BadRequestException('Insufficient credits to transfer.');
      }

      const newOriginBalance = originBalance.balance - dto.amount;
      const newDestinationBalance = destinationBalance.balance + dto.amount;

      await tx.zoomCreditBalance.update({
        where: { userId: dto.fromUserId },
        data: { balance: newOriginBalance },
      });
      await tx.zoomCreditBalance.update({
        where: { userId: dto.toUserId },
        data: { balance: newDestinationBalance },
      });

      const outboundTransaction = await tx.zoomCreditTransaction.create({
        data: {
          userId: dto.fromUserId,
          relatedUserId: dto.toUserId,
          type: ZoomCreditTransactionType.TRANSFER_OUT,
          amount: dto.amount,
          runningBalance: newOriginBalance,
          reason: dto.reason,
          metadata: this.toInputJson(dto.metadata),
        },
      });

      const inboundTransaction = await tx.zoomCreditTransaction.create({
        data: {
          userId: dto.toUserId,
          relatedUserId: dto.fromUserId,
          type: ZoomCreditTransactionType.TRANSFER_IN,
          amount: dto.amount,
          runningBalance: newDestinationBalance,
          reason: dto.reason,
          metadata: this.toInputJson(dto.metadata),
        },
      });

      await tx.zoomCreditAuditLog.createMany({
        data: [
          {
            transactionId: outboundTransaction.id,
            actorId: actorId ?? null,
            action: ZoomCreditAuditAction.CREATED,
            details: this.toInputJson({
              reason: dto.reason,
              metadata: dto.metadata ?? null,
              direction: 'outbound',
              counterparty: dto.toUserId,
            }),
          },
          {
            transactionId: inboundTransaction.id,
            actorId: actorId ?? null,
            action: ZoomCreditAuditAction.CREATED,
            details: this.toInputJson({
              reason: dto.reason,
              metadata: dto.metadata ?? null,
              direction: 'inbound',
              counterparty: dto.fromUserId,
            }),
          },
        ],
      });

      return { outbound: outboundTransaction, inbound: inboundTransaction };
    });

    this.logger.log(
      `Transferred ${dto.amount} zoom credits from ${dto.fromUserId} to ${dto.toUserId}`,
    );
    return {
      outbound: this.mapTransactionEntity(outbound),
      inbound: this.mapTransactionEntity(inbound),
    };
  }

  async purchaseCredits(
    userId: string,
    dto: PurchaseZoomCreditsDto,
  ): Promise<PurchaseZoomCreditsResponseDto> {
    if (!userId) {
      throw new BadRequestException('Unable to resolve purchaser account.');
    }

    const amount = Math.trunc(dto.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a positive whole number.');
    }

    const planId = dto.planId?.trim() || undefined;
    const currency = dto.currency?.trim().toUpperCase() || 'USD';
    const paymentReference =
      dto.paymentReference?.trim() ||
      `PUR-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

    const transaction = await this.adjustCredits(
      {
        userId,
        operation: ZoomCreditOperation.CREDIT,
        amount,
        reason: planId ? `Purchased credits (${planId})` : 'Purchased credits',
        metadata: {
          source: 'purchase',
          planId: planId ?? null,
          currency,
          paymentReference,
          paymentStatus: 'COMPLETED',
        },
      },
      userId,
    );

    const summary = await this.getSummary(userId);

    await this.paymentsService.recordInternalPurchase(
      userId,
      amount,
      'internal',
      paymentReference,
    );

    return {
      summary,
      transaction,
    };
  }

  async getSummary(userId: string): Promise<ZoomCreditSummaryEntity> {
    const [balance, aggregates] = await this.prisma.$transaction([
      this.prisma.zoomCreditBalance.upsert({
        where: { userId },
        update: {},
        create: { userId, balance: 0 },
      }),
      this.prisma.zoomCreditTransaction.groupBy({
        by: ['type'],
        where: { userId },
        orderBy: { type: 'asc' },
        _sum: { amount: true },
      }),
    ]);

    const totalCredited = aggregates
      .filter(
        (item) =>
          item.type === ZoomCreditTransactionType.CREDIT ||
          item.type === ZoomCreditTransactionType.TRANSFER_IN,
      )
      .reduce((acc, item) => acc + (item._sum?.amount ?? 0), 0);

    const totalDebited = aggregates
      .filter(
        (item) =>
          item.type === ZoomCreditTransactionType.DEBIT ||
          item.type === ZoomCreditTransactionType.TRANSFER_OUT,
      )
      .reduce((acc, item) => acc + (item._sum?.amount ?? 0), 0);

    return new ZoomCreditSummaryEntity({
      userId,
      totalCredited,
      totalDebited,
      balance: balance.balance,
      updatedAt: balance.updatedAt,
    });
  }

  async getTransactions(
    userId: string,
    query: ZoomCreditTransactionsQueryDto,
  ): Promise<PaginatedZoomCreditTransactionsResponseDto> {
    const where: Prisma.ZoomCreditTransactionWhereInput = {
      userId,
      ...(query.type ? { type: query.type } : {}),
    };

    const skip = (query.page - 1) * query.limit;
    const [total, transactions] = await this.prisma.$transaction([
      this.prisma.zoomCreditTransaction.count({ where }),
      this.prisma.zoomCreditTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
    ]);

    const totalPages = Math.max(Math.ceil(total / query.limit), 1);
    const meta = {
      total,
      count: transactions.length,
      currentPage: query.page,
      totalPages,
      nextPage: query.page < totalPages ? query.page + 1 : null,
      previousPage: query.page > 1 ? query.page - 1 : null,
    };

    return {
      data: transactions.map((tx) => this.mapTransactionEntity(tx)),
      meta,
    };
  }

  private ensureBalance(tx: Prisma.TransactionClient, userId: string) {
    return tx.zoomCreditBalance.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
    });
  }

  private mapTransactionEntity(
    transaction: ZoomCreditTransaction,
  ): ZoomCreditTransactionEntity {
    return new ZoomCreditTransactionEntity({
      ...transaction,
      metadata: this.toPlainMetadata(transaction.metadata),
    });
  }

  private toInputJson(
    value?: Record<string, unknown> | null,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return Prisma.JsonNull;
    }
    return value as Prisma.InputJsonValue;
  }

  private toPlainMetadata(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  async getUsageTrend(
    userId: string,
    days: number,
  ): Promise<{
    days: number;
    series: Array<{
      date: string;
      credited: number;
      debited: number;
      net: number;
    }>;
  }> {
    const safeDays = Math.min(Math.max(Math.floor(days || 30), 1), 365);
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (safeDays - 1));

    const txns = await this.prisma.zoomCreditTransaction.findMany({
      where: { userId, createdAt: { gte: since } },
      select: { type: true, amount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const buckets = new Map<string, { credited: number; debited: number }>();
    for (let i = 0; i < safeDays; i++) {
      const d = new Date(since);
      d.setUTCDate(since.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets.set(key, { credited: 0, debited: 0 });
    }

    for (const t of txns) {
      const key = new Date(t.createdAt).toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (
        t.type === ZoomCreditTransactionType.CREDIT ||
        t.type === ZoomCreditTransactionType.TRANSFER_IN
      ) {
        bucket.credited += t.amount;
      } else {
        bucket.debited += t.amount;
      }
    }

    return {
      days: safeDays,
      series: Array.from(buckets.entries()).map(([date, v]) => ({
        date,
        credited: v.credited,
        debited: v.debited,
        net: v.credited - v.debited,
      })),
    };
  }

  async getAcademyTeachersCreditSummary(
    academyId: string,
    ownerId: string,
  ): Promise<
    Array<{
      teacherId: string;
      teacherName: string;
      email: string;
      balance: number;
      totalCredited: number;
      totalDebited: number;
      creditLimit: number | null;
      totalPurchased: number;
    }>
  > {
    await this.assertAcademyOwner(academyId, ownerId);

    const teachers = await this.prisma.academyMembership.findMany({
      where: {
        academyId,
        role: AcademyMemberRole.TEACHER,
        status: AcademyMembershipStatus.APPROVED,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            zoomCreditBalance: true,
          },
        },
      },
    });

    const result: Array<{
      teacherId: string;
      teacherName: string;
      email: string;
      balance: number;
      totalCredited: number;
      totalDebited: number;
      creditLimit: number | null;
      totalPurchased: number;
    }> = [];
    for (const membership of teachers) {
      const user = membership.user;
      const balance = user.zoomCreditBalance?.balance ?? 0;
      const creditLimit = user.zoomCreditBalance?.teacherLimit ?? null;

      const aggregates = await this.prisma.zoomCreditTransaction.groupBy({
        by: ['type'],
        where: { userId: user.id },
        _sum: { amount: true },
      });

      const totalCredited = aggregates
        .filter(
          (item) =>
            item.type === ZoomCreditTransactionType.CREDIT ||
            item.type === ZoomCreditTransactionType.TRANSFER_IN,
        )
        .reduce((acc, item) => acc + (item._sum?.amount ?? 0), 0);

      const totalDebited = aggregates
        .filter(
          (item) =>
            item.type === ZoomCreditTransactionType.DEBIT ||
            item.type === ZoomCreditTransactionType.TRANSFER_OUT,
        )
        .reduce((acc, item) => acc + (item._sum?.amount ?? 0), 0);

      result.push({
        teacherId: user.id,
        teacherName: `${user.firstName} ${user.lastName || ''}`.trim(),
        email: user.email,
        balance,
        totalCredited,
        totalDebited,
        creditLimit,
        totalPurchased: totalCredited,
      });
    }

    return result;
  }

  async setTeacherCreditLimit(
    teacherId: string,
    academyId: string,
    newLimit: number | null,
    changedBy: string,
    reason?: string,
  ): Promise<void> {
    await this.assertAcademyOwner(academyId, changedBy);
    await this.assertTeacherBelongsToAcademy(teacherId, academyId);

    const oldBalance = await this.ensureBalanceSimple(teacherId);
    const oldLimit = oldBalance.teacherLimit;

    await this.prisma.$transaction(async (tx) => {
      await tx.zoomCreditBalance.update({
        where: { userId: teacherId },
        data: { teacherLimit: newLimit },
      });

      await tx.teacherCreditLimitHistory.create({
        data: {
          userId: teacherId,
          academyId,
          oldLimit,
          newLimit,
          changedBy,
          reason: reason ?? null,
          metadata: this.toInputJson({
            timestamp: new Date().toISOString(),
          }),
        },
      });
    });

    this.logger.log(
      `Updated teacher ${teacherId} credit limit from ${oldLimit} to ${newLimit}`,
    );
  }

  async assignCreditsToTeacher(
    teacherId: string,
    academyId: string,
    amount: number,
    ownerId: string,
    reason?: string,
  ): Promise<void> {
    const safeAmount = Math.trunc(amount);
    if (!Number.isFinite(safeAmount) || safeAmount <= 0) {
      throw new BadRequestException(
        'Assignment amount must be a positive whole number.',
      );
    }

    await this.assertAcademyOwner(academyId, ownerId);
    await this.assertTeacherBelongsToAcademy(teacherId, academyId);

    await this.transferCredits(
      {
        fromUserId: ownerId,
        toUserId: teacherId,
        amount: safeAmount,
        reason:
          reason?.trim() || `Assigned ${safeAmount} credits by academy owner`,
        metadata: {
          source: 'academy_owner.assignment',
          academyId,
          teacherId,
        },
      },
      ownerId,
    );
  }

  async getTeacherCreditAuditLog(
    teacherId: string,
    academyId: string,
    ownerId: string,
    take = 50,
    skip = 0,
    filters?: {
      type?: string;
      from?: Date;
      to?: Date;
    },
  ): Promise<{
    transactions: Array<{
      id: string;
      type: string;
      amount: number;
      runningBalance: number;
      reason: string | null;
      createdAt: Date;
    }>;
    limitChanges: Array<{
      id: string;
      oldLimit: number | null;
      newLimit: number | null;
      changedBy: string;
      reason: string | null;
      createdAt: Date;
    }>;
    meta: {
      total: number;
      count: number;
      take: number;
      skip: number;
      nextSkip: number | null;
      previousSkip: number | null;
    };
  }> {
    await this.assertAcademyOwner(academyId, ownerId);
    await this.assertTeacherBelongsToAcademy(teacherId, academyId);

    const safeTake = Math.min(Math.max(Math.floor(take || 50), 1), 100);
    const safeSkip = Math.max(Math.floor(skip || 0), 0);
    const whereDate = {
      ...(filters?.from ? { gte: filters.from } : {}),
      ...(filters?.to ? { lte: filters.to } : {}),
    };

    const txWhere: Prisma.ZoomCreditTransactionWhereInput = {
      userId: teacherId,
      ...(filters?.type
        ? {
            type: filters.type as ZoomCreditTransactionType,
          }
        : {}),
      ...(filters?.from || filters?.to
        ? {
            createdAt: whereDate,
          }
        : {}),
    };

    const limitWhere: Prisma.TeacherCreditLimitHistoryWhereInput = {
      userId: teacherId,
      ...(filters?.from || filters?.to
        ? {
            createdAt: whereDate,
          }
        : {}),
    };

    const [transactions, limitChanges, total] = await this.prisma.$transaction([
      this.prisma.zoomCreditTransaction.findMany({
        where: txWhere,
        select: {
          id: true,
          type: true,
          amount: true,
          runningBalance: true,
          reason: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: safeTake,
        skip: safeSkip,
      }),
      this.prisma.teacherCreditLimitHistory.findMany({
        where: limitWhere,
        select: {
          id: true,
          oldLimit: true,
          newLimit: true,
          changedBy: true,
          reason: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: Math.max(Math.floor(safeTake / 2), 10),
      }),
      this.prisma.zoomCreditTransaction.count({
        where: txWhere,
      }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        ...t,
        type: t.type.toString(),
      })),
      limitChanges,
      meta: {
        total,
        count: transactions.length,
        take: safeTake,
        skip: safeSkip,
        nextSkip:
          safeSkip + transactions.length < total ? safeSkip + safeTake : null,
        previousSkip: safeSkip > 0 ? Math.max(safeSkip - safeTake, 0) : null,
      },
    };
  }

  private async ensureBalanceSimple(userId: string) {
    return this.prisma.zoomCreditBalance.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: 0 },
    });
  }

  private async assertAcademyOwner(
    academyId: string,
    ownerId: string,
  ): Promise<void> {
    const academy = await this.prisma.academy.findUnique({
      where: { id: academyId },
      select: { ownerId: true },
    });

    if (!academy) {
      throw new NotFoundException('Academy not found.');
    }

    if (academy.ownerId !== ownerId) {
      throw new ForbiddenException(
        'You are not authorized to manage credits for this academy.',
      );
    }
  }

  private async assertTeacherBelongsToAcademy(
    teacherId: string,
    academyId: string,
  ): Promise<void> {
    const membership = await this.prisma.academyMembership.findUnique({
      where: {
        academyId_userId: {
          academyId,
          userId: teacherId,
        },
      },
      select: { role: true, status: true },
    });

    if (
      !membership ||
      membership.role !== AcademyMemberRole.TEACHER ||
      membership.status !== AcademyMembershipStatus.APPROVED
    ) {
      throw new BadRequestException(
        'The selected teacher is not an approved member of this academy.',
      );
    }
  }
}

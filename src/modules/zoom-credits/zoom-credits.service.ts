import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma, ZoomCreditAuditAction, ZoomCreditTransaction, ZoomCreditTransactionType } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateZoomCreditTransactionDto, ZoomCreditOperation } from './dto/create-zoom-credit-transaction.dto';
import { TransferZoomCreditsDto } from './dto/transfer-zoom-credits.dto';
import { PaginatedZoomCreditTransactionsResponseDto } from './dto/paginated-zoom-credit-transactions-response.dto';
import { ZoomCreditTransactionsQueryDto } from './dto/zoom-credit-transactions-query.dto';
import { ZoomCreditSummaryEntity } from './entities/zoom-credit-summary.entity';
import { ZoomCreditTransactionEntity } from './entities/zoom-credit-transaction.entity';
import { PurchaseZoomCreditsDto } from './dto/purchase-zoom-credits.dto';
import { PurchaseZoomCreditsResponseDto } from './dto/purchase-zoom-credits-response.dto';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class ZoomCreditsService {
  private readonly logger = new Logger(ZoomCreditsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async adjustCredits(dto: CreateZoomCreditTransactionDto, actorId?: string): Promise<ZoomCreditTransactionEntity> {
    const type = dto.operation === ZoomCreditOperation.CREDIT ? ZoomCreditTransactionType.CREDIT : ZoomCreditTransactionType.DEBIT;

    const transaction = await this.prisma.$transaction(async (tx) => {
      const currentBalance = await this.ensureBalance(tx, dto.userId);

      const updatedBalance =
        type === ZoomCreditTransactionType.CREDIT ? currentBalance.balance + dto.amount : currentBalance.balance - dto.amount;

      if (updatedBalance < 0) {
        throw new BadRequestException('Insufficient credits to complete this operation.');
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

    this.logger.log(`Processed ${type} zoom credit transaction of ${dto.amount} for user ${dto.userId}`);
    return this.mapTransactionEntity(transaction);
  }

  async transferCredits(
    dto: TransferZoomCreditsDto,
    actorId?: string,
  ): Promise<{ outbound: ZoomCreditTransactionEntity; inbound: ZoomCreditTransactionEntity }> {
    if (dto.fromUserId === dto.toUserId) {
      throw new BadRequestException('Cannot transfer credits to the same user.');
    }

    const { outbound, inbound } = await this.prisma.$transaction(async (tx) => {
      const originBalance = await this.ensureBalance(tx, dto.fromUserId);
      const destinationBalance = await this.ensureBalance(tx, dto.toUserId);

      if (originBalance.balance < dto.amount) {
        throw new BadRequestException('Insufficient credits to transfer.');
      }

      const newOriginBalance = originBalance.balance - dto.amount;
      const newDestinationBalance = destinationBalance.balance + dto.amount;

      await tx.zoomCreditBalance.update({ where: { userId: dto.fromUserId }, data: { balance: newOriginBalance } });
      await tx.zoomCreditBalance.update({ where: { userId: dto.toUserId }, data: { balance: newDestinationBalance } });

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

    this.logger.log(`Transferred ${dto.amount} zoom credits from ${dto.fromUserId} to ${dto.toUserId}`);
    return {
      outbound: this.mapTransactionEntity(outbound),
      inbound: this.mapTransactionEntity(inbound),
    };
  }

  async purchaseCredits(userId: string, dto: PurchaseZoomCreditsDto): Promise<PurchaseZoomCreditsResponseDto> {
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
      dto.paymentReference?.trim() || `PUR-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;

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

    await this.paymentsService.recordInternalPurchase(userId, amount, 'internal', paymentReference);

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
      .filter((item) => item.type === ZoomCreditTransactionType.CREDIT || item.type === ZoomCreditTransactionType.TRANSFER_IN)
      .reduce((acc, item) => acc + (item._sum?.amount ?? 0), 0);

    const totalDebited = aggregates
      .filter((item) => item.type === ZoomCreditTransactionType.DEBIT || item.type === ZoomCreditTransactionType.TRANSFER_OUT)
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

  private mapTransactionEntity(transaction: ZoomCreditTransaction): ZoomCreditTransactionEntity {
    return new ZoomCreditTransactionEntity({
      ...transaction,
      metadata: this.toPlainMetadata(transaction.metadata),
    });
  }

  private toInputJson(value?: Record<string, unknown> | null): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return Prisma.JsonNull;
    }
    return value as Prisma.InputJsonValue;
  }

  private toPlainMetadata(value: Prisma.JsonValue | null): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaymentDto, PaymentStatus } from './dto/create-payment.dto';
import { PaymentsQueryDto } from './dto/payments-query.dto';
import { PaginatedPaymentsResponseDto } from './dto/paginated-payments-response.dto';
import { PaymentEntity } from './entities/payment.entity';

type PaymentWithUser = {
  id: string;
  userId: string;
  amount: Prisma.Decimal;
  currency: string;
  provider: string;
  status: string;
  reference: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    firstName: string;
    lastName: string | null;
    email: string;
  };
};

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePaymentDto): Promise<PaymentEntity> {
    const payment = await this.prisma.payment.create({
      data: {
        userId: dto.userId,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency ?? 'USD',
        provider: dto.provider,
        status: dto.status,
        reference: dto.reference,
        metadata: this.toInputJson(dto.metadata),
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    return this.toEntity(payment);
  }

  async recordInternalPurchase(userId: string, amount: number, provider: string, reference: string): Promise<void> {
    await this.prisma.payment.create({
      data: {
        userId,
        amount: new Prisma.Decimal(amount),
        currency: 'USD',
        provider,
        status: PaymentStatus.COMPLETED,
        reference,
        metadata: this.toInputJson({
          source: 'zoom-credits',
        }),
      },
    });
  }

  async findAll(query: PaymentsQueryDto, currentUserId: string, isSuperAdmin: boolean): Promise<PaginatedPaymentsResponseDto> {
    const where: Prisma.PaymentWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.provider ? { provider: query.provider } : {}),
    };

    if (query.from || query.to) {
      where.createdAt = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    if (isSuperAdmin) {
      if (query.userId) {
        where.userId = query.userId;
      }
    } else {
      where.userId = currentUserId;
    }

    const skip = (query.page - 1) * query.limit;

    const [total, payments, amountAggregate, statusAggregates] = await this.prisma.$transaction([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      this.prisma.payment.aggregate({
        where,
        _sum: { amount: true },
      }),
      this.prisma.payment.groupBy({
        where,
        by: ['status'],
        orderBy: { status: 'asc' },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

    const summary = {
      totalAmount: Number(amountAggregate._sum?.amount ?? 0),
      totalCount: total,
      byStatus: statusAggregates.map((aggregate) => {
        const count =
          typeof aggregate._count === 'object' && aggregate._count !== null && '_all' in aggregate._count
            ? (aggregate._count._all ?? 0)
            : typeof aggregate._count === 'number'
            ? aggregate._count
            : 0;
        return {
          status: aggregate.status,
          count,
          amount: Number(aggregate._sum?.amount ?? 0),
        };
      }),
    };

    return {
      data: payments.map((payment) => this.toEntity(payment)),
      meta: {
        total,
        count: payments.length,
        currentPage: query.page,
        totalPages,
        nextPage: query.page < totalPages ? query.page + 1 : null,
        previousPage: query.page > 1 ? query.page - 1 : null,
      },
      summary,
    };
  }

  private toEntity(payment: PaymentWithUser): PaymentEntity {
    return new PaymentEntity({
      id: payment.id,
      userId: payment.userId,
      amount: Number(payment.amount),
      currency: payment.currency,
      provider: payment.provider,
      status: payment.status,
      reference: payment.reference,
      metadata: this.toPlainMetadata(payment.metadata),
      userName: payment.user
        ? [payment.user.firstName, payment.user.lastName].filter(Boolean).join(' ') || payment.user.email
        : null,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
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

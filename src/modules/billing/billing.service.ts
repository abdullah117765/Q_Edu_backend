import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    Prisma,
    SubscriptionInterval,
    SubscriptionStatus,
    ZoomCreditAuditAction,
    ZoomCreditPackage,
    ZoomCreditPackageBillingType,
    ZoomCreditTransactionType,
} from '@prisma/client';
import type Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { StripeService } from '../stripe/stripe.service';
import { CouponsService } from './coupons.service';
import { CreatePackageDto, UpdatePackageDto } from './dto/package.dto';
import {
    CreateSubscriptionPlanDto,
    StartCheckoutDto,
    UpdateSubscriptionPlanDto,
} from './dto/subscription.dto';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly coupons: CouponsService,
    private readonly notifications: NotificationsService,
  ) {}

  // ---------- Packages ----------

  listPackages(opts: { activeOnly?: boolean } = {}) {
    return this.prisma.zoomCreditPackage.findMany({
      where: opts.activeOnly ? { active: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
    });
  }

  async createPackage(dto: CreatePackageDto): Promise<ZoomCreditPackage> {
    return this.prisma.zoomCreditPackage.create({
      data: {
        name: dto.name,
        description: dto.description,
        credits: dto.credits,
        priceCents: dto.priceCents,
        currency: (
          dto.currency ?? this.stripe.getConfig().currency
        ).toUpperCase(),
        billingType: dto.billingType ?? ZoomCreditPackageBillingType.ONE_TIME,
        bonusCredits: dto.bonusCredits ?? 0,
        highlight: dto.highlight ?? false,
        active: dto.active ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updatePackage(
    id: string,
    dto: UpdatePackageDto,
  ): Promise<ZoomCreditPackage> {
    const existing = await this.prisma.zoomCreditPackage.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Package not found.');
    return this.prisma.zoomCreditPackage.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.credits !== undefined ? { credits: dto.credits } : {}),
        ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
        ...(dto.currency !== undefined
          ? { currency: dto.currency.toUpperCase() }
          : {}),
        ...(dto.billingType !== undefined
          ? { billingType: dto.billingType }
          : {}),
        ...(dto.bonusCredits !== undefined
          ? { bonusCredits: dto.bonusCredits }
          : {}),
        ...(dto.highlight !== undefined ? { highlight: dto.highlight } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async deletePackage(id: string): Promise<void> {
    const existing = await this.prisma.zoomCreditPackage.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Package not found.');
    // Soft-disable rather than hard delete to preserve payment FK history.
    await this.prisma.zoomCreditPackage.update({
      where: { id },
      data: { active: false },
    });
  }

  // ---------- Plans ----------

  listPlans(opts: { activeOnly?: boolean } = {}) {
    return this.prisma.subscriptionPlan.findMany({
      where: opts.activeOnly ? { active: true } : undefined,
      orderBy: [{ sortOrder: 'asc' }, { priceCents: 'asc' }],
    });
  }

  async createPlan(dto: CreateSubscriptionPlanDto) {
    return this.prisma.subscriptionPlan.create({
      data: {
        name: dto.name,
        description: dto.description,
        tier: dto.tier,
        priceCents: dto.priceCents,
        currency: (
          dto.currency ?? this.stripe.getConfig().currency
        ).toUpperCase(),
        interval: dto.interval ?? SubscriptionInterval.MONTHLY,
        monthlyClassMinutes: dto.monthlyClassMinutes ?? 0,
        monthlyCredits: dto.monthlyCredits ?? 0,
        maxTeachers: dto.maxTeachers,
        maxStudents: dto.maxStudents,
        highlight: dto.highlight ?? false,
        active: dto.active ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async updatePlan(id: string, dto: UpdateSubscriptionPlanDto) {
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Subscription plan not found.');
    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.tier !== undefined ? { tier: dto.tier } : {}),
        ...(dto.priceCents !== undefined ? { priceCents: dto.priceCents } : {}),
        ...(dto.currency !== undefined
          ? { currency: dto.currency.toUpperCase() }
          : {}),
        ...(dto.interval !== undefined ? { interval: dto.interval } : {}),
        ...(dto.monthlyClassMinutes !== undefined
          ? { monthlyClassMinutes: dto.monthlyClassMinutes }
          : {}),
        ...(dto.monthlyCredits !== undefined
          ? { monthlyCredits: dto.monthlyCredits }
          : {}),
        ...(dto.maxTeachers !== undefined
          ? { maxTeachers: dto.maxTeachers }
          : {}),
        ...(dto.maxStudents !== undefined
          ? { maxStudents: dto.maxStudents }
          : {}),
        ...(dto.highlight !== undefined ? { highlight: dto.highlight } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
  }

  async deletePlan(id: string): Promise<void> {
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Subscription plan not found.');
    await this.prisma.subscriptionPlan.update({
      where: { id },
      data: { active: false },
    });
  }

  // ---------- User-facing ----------

  async getMyBillingOverview(userId: string) {
    const [user, balance, subscription, payments] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, firstName: true, lastName: true },
      }),
      this.prisma.zoomCreditBalance.findUnique({ where: { userId } }),
      this.prisma.subscription.findFirst({
        where: {
          userId,
          status: {
            in: [
              SubscriptionStatus.ACTIVE,
              SubscriptionStatus.TRIALING,
              SubscriptionStatus.PAST_DUE,
            ],
          },
        },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    if (!user) throw new NotFoundException('User not found.');
    return {
      user,
      credits: { balance: balance?.balance ?? 0 },
      subscription,
      recentPayments: payments,
      stripePublishableKey: this.stripe.getPublishableKey(),
      platformFeePercent: this.stripe.getConfig().platformFeePercent,
      currency: this.stripe.getConfig().currency,
    };
  }

  async startPackageCheckout(userId: string, dto: StartCheckoutDto) {
    const pkg = await this.prisma.zoomCreditPackage.findUnique({
      where: { id: dto.id },
    });
    if (!pkg || !pkg.active) {
      throw new NotFoundException('Package not found or inactive.');
    }
    if (pkg.billingType !== ZoomCreditPackageBillingType.ONE_TIME) {
      throw new BadRequestException(
        'Only one-time packages can be checked out via this endpoint.',
      );
    }
    const customer = await this.getOrCreateStripeCustomer(userId);
    const grossCents = pkg.priceCents * (dto.quantity ?? 1);
    const resolvedCoupon = await this.coupons.resolveForCheckout({
      code: dto.couponCode,
      appliesToKind: 'package',
      grossCents,
      userId,
    });
    const split = this.stripe.splitAmountCents(grossCents);
    const session = await this.stripe.createCheckoutSession({
      customerId: customer.stripeCustomerId,
      mode: 'payment',
      quantity: dto.quantity,
      priceId: pkg.stripePriceId ?? undefined,
      discountCouponId: resolvedCoupon?.coupon.stripeCouponId ?? undefined,
      inlinePrice: pkg.stripePriceId
        ? undefined
        : {
            name: pkg.name,
            description: pkg.description ?? undefined,
            unitAmount: pkg.priceCents,
            currency: pkg.currency.toLowerCase(),
          },
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
      metadata: {
        userId,
        kind: 'package',
        packageId: pkg.id,
        credits: String(pkg.credits + (pkg.bonusCredits ?? 0)),
        platformFeeCents: String(split.fee),
        netCents: String(split.net),
        ...(resolvedCoupon
          ? {
              couponId: resolvedCoupon.coupon.id,
              couponCode: resolvedCoupon.coupon.code,
              discountCents: String(resolvedCoupon.discountCents),
            }
          : {}),
      },
    });
    return {
      url: session.url,
      sessionId: session.id,
      expiresAt: session.expires_at,
      splits: split,
    };
  }

  async startPlanCheckout(userId: string, dto: StartCheckoutDto) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: dto.id },
    });
    if (!plan || !plan.active) {
      throw new NotFoundException('Subscription plan not found or inactive.');
    }
    if (!plan.stripePriceId) {
      throw new BadRequestException(
        'Plan is not yet provisioned with a Stripe price. Run the seed/sync first.',
      );
    }
    const customer = await this.getOrCreateStripeCustomer(userId);
    const resolvedCoupon = await this.coupons.resolveForCheckout({
      code: dto.couponCode,
      appliesToKind: 'plan',
      grossCents: plan.priceCents,
      userId,
    });
    const session = await this.stripe.createCheckoutSession({
      customerId: customer.stripeCustomerId,
      mode: 'subscription',
      priceId: plan.stripePriceId,
      discountCouponId: resolvedCoupon?.coupon.stripeCouponId ?? undefined,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
      metadata: {
        userId,
        kind: 'subscription',
        planId: plan.id,
        ...(resolvedCoupon
          ? {
              couponId: resolvedCoupon.coupon.id,
              couponCode: resolvedCoupon.coupon.code,
              discountCents: String(resolvedCoupon.discountCents),
            }
          : {}),
      },
    });
    return {
      url: session.url,
      sessionId: session.id,
      expiresAt: session.expires_at,
    };
  }

  async openBillingPortal(userId: string, returnUrl?: string) {
    const customer = await this.getOrCreateStripeCustomer(userId);
    const session = await this.stripe.createBillingPortalSession(
      customer.stripeCustomerId,
      returnUrl,
    );
    return { url: session.url };
  }

  async cancelMySubscription(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIALING,
            SubscriptionStatus.PAST_DUE,
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) throw new NotFoundException('No active subscription found.');
    if (sub.stripeSubscriptionId) {
      await this.stripe.cancelSubscription(sub.stripeSubscriptionId, true);
    }
    return this.prisma.subscription.update({
      where: { id: sub.id },
      data: { cancelAt: sub.currentPeriodEnd, canceledAt: new Date() },
    });
  }

  // ---------- Admin analytics ----------

  async getAdminAnalytics(opts: {
    from?: Date;
    to?: Date;
    interval?: 'day' | 'week' | 'month';
    provider?: string;
  }) {
    const interval = opts.interval ?? 'day';
    const now = new Date();
    const from =
      opts.from ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const to = opts.to ?? now;

    const where: Prisma.PaymentWhereInput = {
      status: 'completed',
      createdAt: { gte: from, lte: to },
      ...(opts.provider ? { provider: opts.provider } : {}),
    };

    const [
      agg,
      byProvider,
      byPackage,
      byPlan,
      recent,
      activeSubs,
      mrrAgg,
      timeSeriesRows,
    ] = await Promise.all([
      this.prisma.payment.aggregate({
        where,
        _sum: { amount: true, platformFeeAmount: true, netAmount: true },
        _count: { _all: true },
      }),
      this.prisma.payment.groupBy({
        where,
        by: ['provider'],
        _sum: { amount: true, platformFeeAmount: true },
        _count: { _all: true },
      }),
      this.prisma.payment.groupBy({
        where: { ...where, packageId: { not: null } },
        by: ['packageId'],
        _sum: { amount: true, platformFeeAmount: true },
        _count: { _all: true },
      }),
      this.prisma.payment.groupBy({
        where: { ...where, subscriptionId: { not: null } },
        by: ['subscriptionId'],
        _sum: { amount: true, platformFeeAmount: true },
        _count: { _all: true },
      }),
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 25,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          package: { select: { id: true, name: true, credits: true } },
          subscription: { select: { id: true, planId: true } },
        },
      }),
      this.prisma.subscription.count({
        where: { status: SubscriptionStatus.ACTIVE },
      }),
      this.prisma.subscription.findMany({
        where: { status: SubscriptionStatus.ACTIVE },
        include: { plan: true },
      }),
      this.prisma.payment.findMany({
        where,
        select: {
          createdAt: true,
          amount: true,
          platformFeeAmount: true,
          netAmount: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const monthlyRecurringCents = mrrAgg.reduce((acc, sub) => {
      const cents = sub.plan.priceCents;
      const factor =
        sub.plan.interval === SubscriptionInterval.YEARLY ? 1 / 12 : 1;
      return acc + Math.round(cents * factor);
    }, 0);

    const timeSeries = this.buildRevenueSeries(
      timeSeriesRows,
      from,
      to,
      interval,
    );

    return {
      totals: {
        gross: Number(agg._sum.amount ?? 0),
        platformFee: Number(agg._sum.platformFeeAmount ?? 0),
        net: Number(agg._sum.netAmount ?? 0),
        transactionCount: agg._count._all,
        platformFeePercent: this.stripe.getConfig().platformFeePercent,
      },
      mrrCents: monthlyRecurringCents,
      activeSubscriptions: activeSubs,
      byProvider,
      byPackage,
      byPlan,
      timeSeries,
      recent,
    };
  }

  // ---------- Admin: payments & subscriptions management ----------

  async listPaymentsAdmin(opts: {
    page?: number;
    limit?: number;
    status?: string;
    provider?: string;
    userId?: string;
    packageId?: string;
    subscriptionId?: string;
    from?: Date;
    to?: Date;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const where: Prisma.PaymentWhereInput = {};
    if (opts.status) where.status = opts.status;
    if (opts.provider) where.provider = opts.provider;
    if (opts.userId) where.userId = opts.userId;
    if (opts.packageId) where.packageId = opts.packageId;
    if (opts.subscriptionId) where.subscriptionId = opts.subscriptionId;
    if (opts.from || opts.to) {
      where.createdAt = {
        ...(opts.from ? { gte: opts.from } : {}),
        ...(opts.to ? { lte: opts.to } : {}),
      };
    }
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          package: { select: { id: true, name: true, credits: true } },
          subscription: {
            select: {
              id: true,
              status: true,
              plan: { select: { id: true, name: true, tier: true } },
            },
          },
        },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async getPaymentAdmin(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        package: true,
        subscription: { include: { plan: true } },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found.');
    return payment;
  }

  async refundPaymentAdmin(id: string, amountCents?: number) {
    const payment = await this.prisma.payment.findUnique({ where: { id } });
    if (!payment) throw new NotFoundException('Payment not found.');
    if (payment.status === 'refunded') {
      throw new BadRequestException('Payment is already refunded.');
    }
    if (payment.provider !== 'stripe' || !payment.reference) {
      throw new BadRequestException(
        'Only Stripe-tracked payments can be refunded automatically.',
      );
    }
    if (this.stripe.isEnabled()) {
      try {
        const meta = (payment.metadata as Record<string, unknown> | null) ?? {};
        const piId =
          typeof meta.paymentIntent === 'string'
            ? (meta.paymentIntent as string)
            : undefined;
        await this.stripe.refundPayment({
          paymentIntentId: piId,
          checkoutSessionId: payment.reference,
          amountCents,
        });
      } catch (err) {
        this.logger.warn(
          `Stripe refund failed for payment ${id}: ${(err as Error).message}`,
        );
        throw new BadRequestException(
          `Stripe refund failed: ${(err as Error).message}`,
        );
      }
    }
    return this.prisma.payment.update({
      where: { id },
      data: {
        status:
          amountCents && amountCents < Number(payment.amount) * 100
            ? 'partially_refunded'
            : 'refunded',
        metadata: {
          ...((payment.metadata as Record<string, unknown> | null) ?? {}),
          refundedAt: new Date().toISOString(),
          refundedAmountCents:
            amountCents ?? Math.round(Number(payment.amount) * 100),
        },
      },
    });
  }

  async listSubscriptionsAdmin(opts: {
    page?: number;
    limit?: number;
    status?: SubscriptionStatus;
    userId?: string;
  }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const where: Prisma.SubscriptionWhereInput = {};
    if (opts.status) where.status = opts.status;
    if (opts.userId) where.userId = opts.userId;
    const [items, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          plan: true,
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async cancelSubscriptionAdmin(id: string, immediate = false) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Subscription not found.');
    if (sub.stripeSubscriptionId) {
      try {
        await this.stripe.cancelSubscription(
          sub.stripeSubscriptionId,
          !immediate,
        );
      } catch (err) {
        this.logger.warn(
          `Stripe cancel failed for sub ${id}: ${(err as Error).message}`,
        );
      }
    }
    return this.prisma.subscription.update({
      where: { id },
      data: {
        status: immediate ? SubscriptionStatus.CANCELED : sub.status,
        cancelAt: immediate ? new Date() : sub.currentPeriodEnd,
        canceledAt: new Date(),
      },
    });
  }

  // ---------- Stripe Webhook handling ----------

  async handleStripeEvent(event: Stripe.Event): Promise<void> {
    // Idempotency: persist event id then short-circuit on retry.
    try {
      await this.prisma.stripeWebhookEvent.create({
        data: {
          id: event.id,
          type: event.type,
          payload: event as unknown as Prisma.InputJsonValue,
        },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        this.logger.warn(
          `Duplicate webhook ${event.id} (${event.type}) - skipping.`,
        );
        return;
      }
      throw err;
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.onCheckoutCompleted(
            event.data.object as Stripe.Checkout.Session,
          );
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
          await this.onSubscriptionEvent(
            event.data.object as Stripe.Subscription,
          );
          break;
        case 'invoice.payment_succeeded':
          await this.onInvoicePaid(event.data.object as Stripe.Invoice);
          break;
        case 'invoice.payment_failed':
          await this.onInvoiceFailed(event.data.object as Stripe.Invoice);
          break;
        default:
          this.logger.log(`Unhandled Stripe event ${event.type}`);
      }
      await this.prisma.stripeWebhookEvent.update({
        where: { id: event.id },
        data: { processedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(
        `Failed to process webhook ${event.id} (${event.type}): ${(err as Error).message}`,
      );
      throw err;
    }
  }

  private async onCheckoutCompleted(
    session: Stripe.Checkout.Session,
  ): Promise<void> {
    const meta = session.metadata ?? {};
    const userId = meta.userId;
    if (!userId) {
      this.logger.warn(
        `checkout.session.completed without userId: ${session.id}`,
      );
      return;
    }
    const grossCents = session.amount_total ?? 0;
    const split = this.stripe.splitAmountCents(grossCents);
    const currency = (
      session.currency ?? this.stripe.getConfig().currency
    ).toUpperCase();

    if (meta.kind === 'package' && meta.packageId) {
      const pkg = await this.prisma.zoomCreditPackage.findUnique({
        where: { id: meta.packageId },
      });
      if (!pkg) return;
      const credits = pkg.credits + (pkg.bonusCredits ?? 0);
      await this.prisma.$transaction(async (tx) => {
        const balance = await tx.zoomCreditBalance.upsert({
          where: { userId },
          create: { userId, balance: credits },
          update: { balance: { increment: credits } },
        });
        const txn = await tx.zoomCreditTransaction.create({
          data: {
            userId,
            type: ZoomCreditTransactionType.CREDIT,
            amount: credits,
            runningBalance: balance.balance,
            reason: `Stripe checkout (${pkg.name})`,
            metadata: { stripeSessionId: session.id, packageId: pkg.id },
          },
        });
        await tx.zoomCreditAuditLog.create({
          data: {
            transactionId: txn.id,
            action: ZoomCreditAuditAction.CREATED,
            details: { source: 'stripe.checkout.session.completed' },
          },
        });
        await tx.payment.create({
          data: {
            userId,
            amount: this.toMoney(grossCents),
            platformFeeAmount: this.toMoney(split.fee),
            netAmount: this.toMoney(split.net),
            currency,
            provider: 'stripe',
            status: 'completed',
            reference: session.id,
            description: `Credit pack: ${pkg.name} (+${credits} credits)`,
            packageId: pkg.id,
            metadata: {
              stripeSessionId: session.id,
              paymentIntent:
                typeof session.payment_intent === 'string'
                  ? session.payment_intent
                  : (session.payment_intent?.id ?? null),
            },
          },
        });
      });
      this.logger.log(
        `Granted ${credits} credits to ${userId} for package ${pkg.id}`,
      );
      await this.safeNotify(
        userId,
        'PAYMENT_RECEIVED',
        `Payment received: ${pkg.name}`,
        `+${credits} Zoom credits added to your balance.`,
        { kind: 'package', packageId: pkg.id, credits, grossCents },
      );
      await this.notifyAdmins(
        'PAYMENT_RECEIVED',
        `New payment: ${pkg.name}`,
        `User ${userId} purchased ${pkg.name} ($${(grossCents / 100).toFixed(2)})`,
        { kind: 'package', userId, packageId: pkg.id, grossCents },
      );
      return;
    }

    if (meta.kind === 'subscription') {
      // subscription rows are written by customer.subscription.* events; just record the payment intent here.
      await this.prisma.payment.create({
        data: {
          userId,
          amount: this.toMoney(grossCents),
          platformFeeAmount: this.toMoney(split.fee),
          netAmount: this.toMoney(split.net),
          currency,
          provider: 'stripe',
          status: 'completed',
          reference: session.id,
          description: 'Subscription checkout',
          metadata: { stripeSessionId: session.id, planId: meta.planId },
        },
      });
      await this.safeNotify(
        userId,
        'SUBSCRIPTION_ACTIVATED',
        'Subscription activated',
        'Welcome aboard! Your subscription is now active.',
        { planId: meta.planId, grossCents },
      );
      await this.notifyAdmins(
        'SUBSCRIPTION_ACTIVATED',
        'New subscription',
        `User ${userId} activated plan ${meta.planId}.`,
        { userId, planId: meta.planId, grossCents },
      );
    }

    if (meta.couponId) {
      try {
        await this.coupons.recordRedemption({
          couponId: meta.couponId,
          userId,
          amountOffCents: meta.discountCents
            ? Number(meta.discountCents)
            : undefined,
        });
        await this.safeNotify(
          userId,
          'COUPON_REDEEMED',
          'Coupon applied',
          `Your discount was applied at checkout.`,
          {
            couponId: meta.couponId,
            discountCents: meta.discountCents ?? null,
          },
        );
      } catch (err) {
        this.logger.warn(
          `Failed to record coupon redemption: ${(err as Error).message}`,
        );
      }
    }
  }

  private async onSubscriptionEvent(
    stripeSub: Stripe.Subscription,
  ): Promise<void> {
    const userId = (stripeSub.metadata as Record<string, string> | null)
      ?.userId;
    const planId = (stripeSub.metadata as Record<string, string> | null)
      ?.planId;
    if (!userId || !planId) {
      this.logger.warn(
        `subscription event missing metadata.userId/planId: ${stripeSub.id}`,
      );
      return;
    }
    const data = {
      status: this.mapSubStatus(stripeSub.status),
      stripeSubscriptionId: stripeSub.id,
      stripeCustomerId:
        typeof stripeSub.customer === 'string'
          ? stripeSub.customer
          : stripeSub.customer.id,
      currentPeriodStart: this.toDate(stripeSub.current_period_start),
      currentPeriodEnd: this.toDate(stripeSub.current_period_end),
      cancelAt: this.toDate(stripeSub.cancel_at),
      canceledAt: this.toDate(stripeSub.canceled_at),
      trialEnd: this.toDate(stripeSub.trial_end),
    };
    const existing = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSub.id },
    });
    if (existing) {
      await this.prisma.subscription.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await this.prisma.subscription.create({
        data: { userId, planId, ...data },
      });
    }
  }

  private async onInvoicePaid(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription || typeof invoice.subscription !== 'string')
      return;
    const sub = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: invoice.subscription },
    });
    if (!sub) return;
    const grossCents = invoice.amount_paid ?? 0;
    const split = this.stripe.splitAmountCents(grossCents);
    await this.prisma.payment.create({
      data: {
        userId: sub.userId,
        amount: this.toMoney(grossCents),
        platformFeeAmount: this.toMoney(split.fee),
        netAmount: this.toMoney(split.net),
        currency: (
          invoice.currency ?? this.stripe.getConfig().currency
        ).toUpperCase(),
        provider: 'stripe',
        status: 'completed',
        reference: invoice.id,
        description: 'Subscription invoice paid',
        subscriptionId: sub.id,
        metadata: {
          invoiceId: invoice.id,
          hostedInvoiceUrl: invoice.hosted_invoice_url,
        },
      },
    });
    await this.safeNotify(
      sub.userId,
      'PAYMENT_RECEIVED',
      'Subscription renewed',
      `Your subscription invoice was paid ($${(grossCents / 100).toFixed(2)}).`,
      { invoiceId: invoice.id, hostedInvoiceUrl: invoice.hosted_invoice_url },
    );
  }

  private async onInvoiceFailed(invoice: Stripe.Invoice): Promise<void> {
    if (!invoice.subscription || typeof invoice.subscription !== 'string')
      return;
    const sub = await this.prisma.subscription.findUnique({
      where: { stripeSubscriptionId: invoice.subscription },
    });
    if (!sub) return;
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: SubscriptionStatus.PAST_DUE },
    });
    await this.safeNotify(
      sub.userId,
      'PAYMENT_FAILED',
      'Payment failed',
      'Your subscription payment could not be processed. Please update your card.',
      { invoiceId: invoice.id, hostedInvoiceUrl: invoice.hosted_invoice_url },
    );
    await this.notifyAdmins(
      'PAYMENT_FAILED',
      'Subscription payment failed',
      `User ${sub.userId} subscription payment failed (invoice ${invoice.id}).`,
      { userId: sub.userId, invoiceId: invoice.id },
    );
  }

  // ---------- notification helpers ----------

  private async safeNotify(
    userId: string,
    type:
      | 'PAYMENT_RECEIVED'
      | 'PAYMENT_FAILED'
      | 'SUBSCRIPTION_ACTIVATED'
      | 'SUBSCRIPTION_CANCELLED'
      | 'COUPON_REDEEMED'
      | 'GENERIC',
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.notifications.notify({
        userId,
        type: type as any,
        title,
        body,
        data: (data ?? {}) as Prisma.InputJsonValue,
      });
    } catch (err) {
      this.logger.warn(
        `Notification dispatch failed for user=${userId}: ${(err as Error).message}`,
      );
    }
  }

  private async notifyAdmins(
    type:
      | 'PAYMENT_RECEIVED'
      | 'PAYMENT_FAILED'
      | 'SUBSCRIPTION_ACTIVATED'
      | 'SUBSCRIPTION_CANCELLED'
      | 'COUPON_REDEEMED'
      | 'GENERIC',
    title: string,
    body: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    try {
      const admins = await this.prisma.user.findMany({
        where: { role: 'SUPER_ADMIN' as any, isActive: true },
        select: { id: true },
      });
      await Promise.all(
        admins.map((a) => this.safeNotify(a.id, type, title, body, data)),
      );
    } catch (err) {
      this.logger.warn(`Admin broadcast failed: ${(err as Error).message}`);
    }
  }

  // ---------- helpers ----------

  private async getOrCreateStripeCustomer(userId: string) {
    const existing = await this.prisma.stripeCustomer.findUnique({
      where: { userId },
      include: { user: true },
    });
    if (existing) return existing;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');
    const stripeCustomer = await this.stripe.findOrCreateCustomer({
      userId,
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(' '),
    });
    return this.prisma.stripeCustomer.create({
      data: { userId, stripeCustomerId: stripeCustomer.id, email: user.email },
    });
  }

  private toMoney(cents: number) {
    return new Prisma.Decimal((cents / 100).toFixed(2));
  }

  private toDate(seconds: number | null | undefined): Date | null {
    return seconds ? new Date(seconds * 1000) : null;
  }

  private mapSubStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
    switch (status) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'trialing':
        return SubscriptionStatus.TRIALING;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'canceled':
        return SubscriptionStatus.CANCELED;
      case 'incomplete':
        return SubscriptionStatus.INCOMPLETE;
      case 'incomplete_expired':
        return SubscriptionStatus.INCOMPLETE_EXPIRED;
      case 'unpaid':
        return SubscriptionStatus.UNPAID;
      default:
        return SubscriptionStatus.INCOMPLETE;
    }
  }

  private buildRevenueSeries(
    rows: Array<{
      createdAt: Date;
      amount: Prisma.Decimal;
      platformFeeAmount: Prisma.Decimal | null;
      netAmount: Prisma.Decimal | null;
    }>,
    from: Date,
    to: Date,
    interval: 'day' | 'week' | 'month',
  ) {
    const buckets = new Map<
      string,
      {
        label: string;
        gross: number;
        platformFee: number;
        net: number;
        count: number;
      }
    >();

    const cursor = new Date(from);
    while (cursor <= to) {
      const bucketDate = new Date(cursor);
      const key = this.bucketKey(bucketDate, interval);
      if (!buckets.has(key)) {
        buckets.set(key, {
          label: key,
          gross: 0,
          platformFee: 0,
          net: 0,
          count: 0,
        });
      }
      this.advanceCursor(cursor, interval);
    }

    for (const row of rows) {
      const key = this.bucketKey(row.createdAt, interval);
      const current = buckets.get(key);
      if (!current) continue;
      current.gross += Number(row.amount ?? 0);
      current.platformFee += Number(row.platformFeeAmount ?? 0);
      current.net += Number(row.netAmount ?? 0);
      current.count += 1;
    }

    return Array.from(buckets.values());
  }

  private bucketKey(date: Date, interval: 'day' | 'week' | 'month'): string {
    const year = date.getUTCFullYear();
    const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
    const day = `${date.getUTCDate()}`.padStart(2, '0');

    if (interval === 'day') {
      return `${year}-${month}-${day}`;
    }

    if (interval === 'month') {
      return `${year}-${month}`;
    }

    const weekStart = new Date(
      Date.UTC(year, date.getUTCMonth(), date.getUTCDate()),
    );
    const dayOfWeek = weekStart.getUTCDay();
    const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    weekStart.setUTCDate(weekStart.getUTCDate() - offset);
    const wsYear = weekStart.getUTCFullYear();
    const wsMonth = `${weekStart.getUTCMonth() + 1}`.padStart(2, '0');
    const wsDay = `${weekStart.getUTCDate()}`.padStart(2, '0');
    return `${wsYear}-${wsMonth}-${wsDay}`;
  }

  private advanceCursor(cursor: Date, interval: 'day' | 'week' | 'month') {
    if (interval === 'day') {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      return;
    }
    if (interval === 'week') {
      cursor.setUTCDate(cursor.getUTCDate() + 7);
      return;
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
}

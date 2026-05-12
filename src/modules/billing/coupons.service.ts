import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import {
    Coupon,
    CouponAppliesTo,
    CouponDiscountType,
    CouponDuration,
    Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { CreateCouponDto, UpdateCouponDto } from './dto/coupon.dto';

export interface ResolvedCoupon {
  coupon: Coupon;
  discountCents: number;
  appliesToKind: 'package' | 'plan';
}

@Injectable()
export class CouponsService {
  private readonly logger = new Logger(CouponsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
  ) {}

  // ----- Admin CRUD -----

  async list(
    opts: {
      activeOnly?: boolean;
      marketingOnly?: boolean;
      page?: number;
      limit?: number;
      search?: string;
      appliesTo?: string;
    } = {},
  ) {
    // When called without pagination opts (e.g. marketing banner), return raw array
    const paginate = opts.page !== undefined || opts.limit !== undefined;
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 25));

    const where: Prisma.CouponWhereInput = {};
    if (opts.activeOnly) where.active = true;
    if (opts.marketingOnly) {
      where.highlight = true;
      where.active = true;
      where.AND = [
        { OR: [{ startsAt: null }, { startsAt: { lte: new Date() } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }] },
      ];
    }
    if (opts.appliesTo && opts.appliesTo !== 'ALL') {
      where.appliesTo = opts.appliesTo as any;
    }
    if (opts.search) {
      const s = opts.search.trim();
      where.OR = [
        { code: { contains: s } },
        { name: { contains: s } },
        { description: { contains: s } },
      ];
    }

    if (!paginate) {
      return this.prisma.coupon.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
      });
    }

    const [items, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.coupon.count({ where }),
    ]);
    return { items, page, limit, total, totalPages: Math.ceil(total / limit) };
  }

  async create(dto: CreateCouponDto): Promise<Coupon> {
    this.validateDiscountShape(dto);
    const exists = await this.prisma.coupon.findUnique({
      where: { code: dto.code.toUpperCase() },
    });
    if (exists)
      throw new BadRequestException(`Coupon code ${dto.code} already exists.`);
    let stripeCouponId: string | null = null;
    let stripePromotionCodeId: string | null = null;
    if (this.stripe.isEnabled()) {
      try {
        const sCoupon = await this.stripe.createCoupon({
          name: dto.name,
          percentOff:
            dto.discountType === CouponDiscountType.PERCENT
              ? dto.percentOff
              : undefined,
          amountOffCents:
            dto.discountType === CouponDiscountType.AMOUNT
              ? dto.amountOffCents
              : undefined,
          currency: dto.currency,
          duration: dto.duration ?? CouponDuration.ONCE,
          durationMonths: dto.durationMonths,
          maxRedemptions: dto.maxRedemptions,
          redeemBy: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        });
        stripeCouponId = sCoupon.id;
        const sPromo = await this.stripe.createPromotionCode({
          couponId: sCoupon.id,
          code: dto.code.toUpperCase(),
          maxRedemptions: dto.maxRedemptions,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
          active: dto.active ?? true,
        });
        stripePromotionCodeId = sPromo.id;
      } catch (err) {
        this.logger.warn(
          `Stripe coupon sync failed: ${(err as Error).message}`,
        );
      }
    }
    return this.prisma.coupon.create({
      data: {
        code: dto.code.toUpperCase(),
        name: dto.name,
        description: dto.description,
        discountType: dto.discountType,
        percentOff: dto.percentOff,
        amountOffCents: dto.amountOffCents,
        currency: (dto.currency ?? 'USD').toUpperCase(),
        duration: dto.duration ?? CouponDuration.ONCE,
        durationMonths: dto.durationMonths,
        appliesTo: dto.appliesTo ?? CouponAppliesTo.ALL,
        maxRedemptions: dto.maxRedemptions,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        active: dto.active ?? true,
        highlight: dto.highlight ?? false,
        marketingTitle: dto.marketingTitle,
        marketingBody: dto.marketingBody,
        stripeCouponId,
        stripePromotionCodeId,
      },
    });
  }

  async update(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found.');
    // For Stripe-managed fields (percent/amount/duration) we don't mutate Stripe; warn instead.
    if (
      this.stripe.isEnabled() &&
      existing.stripePromotionCodeId &&
      dto.active !== undefined &&
      dto.active !== existing.active
    ) {
      try {
        await this.stripe.updatePromotionCode(existing.stripePromotionCodeId, {
          active: dto.active,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to update Stripe promotion code state: ${(err as Error).message}`,
        );
      }
    }
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.appliesTo !== undefined ? { appliesTo: dto.appliesTo } : {}),
        ...(dto.maxRedemptions !== undefined
          ? { maxRedemptions: dto.maxRedemptions }
          : {}),
        ...(dto.startsAt !== undefined
          ? { startsAt: dto.startsAt ? new Date(dto.startsAt) : null }
          : {}),
        ...(dto.expiresAt !== undefined
          ? { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.highlight !== undefined ? { highlight: dto.highlight } : {}),
        ...(dto.marketingTitle !== undefined
          ? { marketingTitle: dto.marketingTitle }
          : {}),
        ...(dto.marketingBody !== undefined
          ? { marketingBody: dto.marketingBody }
          : {}),
      },
    });
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.coupon.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Coupon not found.');
    // Soft-disable to preserve redemption history.
    await this.prisma.coupon.update({ where: { id }, data: { active: false } });
    if (this.stripe.isEnabled() && existing.stripePromotionCodeId) {
      try {
        await this.stripe.updatePromotionCode(existing.stripePromotionCodeId, {
          active: false,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to deactivate Stripe promotion code: ${(err as Error).message}`,
        );
      }
    }
  }

  // ----- Public-facing -----

  async getActiveMarketing() {
    return this.list({ marketingOnly: true });
  }

  async resolveForCheckout(opts: {
    code?: string;
    appliesToKind: 'package' | 'plan';
    grossCents: number;
    userId?: string;
  }): Promise<ResolvedCoupon | null> {
    if (!opts.code) return null;
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: opts.code.toUpperCase() },
    });
    if (!coupon) throw new BadRequestException('Coupon code not found.');
    if (!coupon.active) throw new BadRequestException('Coupon is inactive.');
    const now = new Date();
    if (coupon.startsAt && coupon.startsAt > now)
      throw new BadRequestException('Coupon is not yet active.');
    if (coupon.expiresAt && coupon.expiresAt < now)
      throw new BadRequestException('Coupon has expired.');
    if (
      coupon.maxRedemptions &&
      coupon.timesRedeemed >= coupon.maxRedemptions
    ) {
      throw new BadRequestException('Coupon redemption limit reached.');
    }
    // Per-user single-use enforcement
    if (opts.userId) {
      const alreadyUsed = await this.prisma.couponRedemption.findFirst({
        where: { couponId: coupon.id, userId: opts.userId },
        select: { id: true },
      });
      if (alreadyUsed) {
        throw new BadRequestException('You have already redeemed this coupon.');
      }
    }
    if (
      coupon.appliesTo === CouponAppliesTo.PACKAGES &&
      opts.appliesToKind !== 'package'
    ) {
      throw new BadRequestException(
        'Coupon is only valid for credit packages.',
      );
    }
    if (
      coupon.appliesTo === CouponAppliesTo.PLANS &&
      opts.appliesToKind !== 'plan'
    ) {
      throw new BadRequestException(
        'Coupon is only valid for subscription plans.',
      );
    }
    const discountCents = this.calculateDiscount(coupon, opts.grossCents);
    return { coupon, discountCents, appliesToKind: opts.appliesToKind };
  }

  calculateDiscount(coupon: Coupon, grossCents: number): number {
    if (
      coupon.discountType === CouponDiscountType.PERCENT &&
      coupon.percentOff
    ) {
      return Math.min(
        grossCents,
        Math.round((grossCents * coupon.percentOff) / 100),
      );
    }
    if (
      coupon.discountType === CouponDiscountType.AMOUNT &&
      coupon.amountOffCents
    ) {
      return Math.min(grossCents, coupon.amountOffCents);
    }
    return 0;
  }

  async recordRedemption(opts: {
    couponId: string;
    userId?: string;
    paymentId?: string;
    amountOffCents?: number;
  }) {
    await this.prisma.$transaction([
      this.prisma.couponRedemption.create({
        data: {
          couponId: opts.couponId,
          userId: opts.userId,
          paymentId: opts.paymentId,
          amountOffCents: opts.amountOffCents,
        },
      }),
      this.prisma.coupon.update({
        where: { id: opts.couponId },
        data: { timesRedeemed: { increment: 1 } },
      }),
    ]);
  }

  private validateDiscountShape(dto: CreateCouponDto) {
    if (dto.discountType === CouponDiscountType.PERCENT && !dto.percentOff) {
      throw new BadRequestException(
        'percentOff is required for PERCENT coupons.',
      );
    }
    if (dto.discountType === CouponDiscountType.AMOUNT && !dto.amountOffCents) {
      throw new BadRequestException(
        'amountOffCents is required for AMOUNT coupons.',
      );
    }
    if (dto.duration === CouponDuration.REPEATING && !dto.durationMonths) {
      throw new BadRequestException(
        'durationMonths is required for REPEATING coupons.',
      );
    }
  }
}

import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import {
    CouponAppliesTo,
    CouponDiscountType,
    CouponDuration,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const WELCOME_COUPON_CODE = 'WELCOME';
const WELCOME_COUPON_PERCENT_OFF = 20; // 20% off first credit purchase

@Injectable()
export class WelcomeCouponBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger(WelcomeCouponBootstrap.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const existing = await this.prisma.coupon.findUnique({
      where: { code: WELCOME_COUPON_CODE },
      select: { id: true },
    });

    if (existing) {
      this.logger.log(
        `Welcome coupon "${WELCOME_COUPON_CODE}" already exists — skipping.`,
      );
      return;
    }

    await this.prisma.coupon.create({
      data: {
        code: WELCOME_COUPON_CODE,
        name: 'Welcome Discount',
        description: `${WELCOME_COUPON_PERCENT_OFF}% off your first credit package purchase. One-time use per account.`,
        discountType: CouponDiscountType.PERCENT,
        percentOff: WELCOME_COUPON_PERCENT_OFF,
        duration: CouponDuration.ONCE,
        appliesTo: CouponAppliesTo.PACKAGES,
        active: true,
        highlight: true,
        marketingTitle: `${WELCOME_COUPON_PERCENT_OFF}% off your first top-up`,
        marketingBody:
          'Use code WELCOME at checkout to get a discount on your first Zoom credit package.',
      },
    });

    this.logger.log(
      `Created welcome coupon "${WELCOME_COUPON_CODE}" (${WELCOME_COUPON_PERCENT_OFF}% off packages, one-time per user).`,
    );
  }
}

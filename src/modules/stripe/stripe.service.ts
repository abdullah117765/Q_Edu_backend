import {
    Injectable,
    Logger,
    OnModuleInit,
    ServiceUnavailableException
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export interface StripeConfig {
  enabled: boolean;
  secretKey: string;
  publishableKey: string;
  webhookSecret: string;
  apiVersion: string;
  currency: string;
  platformFeePercent: number;
  successUrl: string;
  cancelUrl: string;
  portalReturnUrl: string;
}

@Injectable()
export class StripeService implements OnModuleInit {
  private readonly logger = new Logger(StripeService.name);
  private client: Stripe | null = null;
  private readonly config: StripeConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<StripeConfig>(
      'stripe',
    ) as StripeConfig;
  }

  onModuleInit(): void {
    if (!this.config?.enabled || !this.config?.secretKey) {
      this.logger.warn(
        'Stripe is not configured (STRIPE_SECRET_KEY missing). Billing endpoints will return 503.',
      );
      return;
    }
    this.client = new Stripe(this.config.secretKey, {
      apiVersion: this.config.apiVersion as Stripe.LatestApiVersion,
      typescript: true,
      appInfo: { name: 'Q Edu', version: '1.0.0' },
    });
    this.logger.log(
      `Stripe initialised (currency=${this.config.currency}, platformFee=${this.config.platformFeePercent}%)`,
    );
  }

  isEnabled(): boolean {
    return Boolean(this.client);
  }

  getConfig(): StripeConfig {
    return this.config;
  }

  /** Returns the publishable key for the frontend (safe to expose). */
  getPublishableKey(): string {
    return this.config?.publishableKey ?? '';
  }

  private getClient(): Stripe {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Billing is not configured on this environment.',
      );
    }
    return this.client;
  }

  /**
   * Calculate the 10% (configurable) platform fee from a gross amount, in *cents*.
   * Returns rounded integer cents.
   */
  calculatePlatformFeeCents(grossCents: number): number {
    const pct = this.config.platformFeePercent ?? 10;
    return Math.round((grossCents * pct) / 100);
  }

  splitAmountCents(grossCents: number): {
    gross: number;
    fee: number;
    net: number;
    feePercent: number;
  } {
    const fee = this.calculatePlatformFeeCents(grossCents);
    return {
      gross: grossCents,
      fee,
      net: grossCents - fee,
      feePercent: this.config.platformFeePercent ?? 10,
    };
  }

  async findOrCreateCustomer(params: {
    userId: string;
    email: string;
    name?: string;
    existingCustomerId?: string | null;
  }): Promise<Stripe.Customer> {
    const stripe = this.getClient();
    if (params.existingCustomerId) {
      try {
        const existing = await stripe.customers.retrieve(
          params.existingCustomerId,
        );
        if (!existing.deleted) {
          return existing as Stripe.Customer;
        }
      } catch (err) {
        this.logger.warn(
          `Stripe customer ${params.existingCustomerId} not retrievable: ${(err as Error).message}`,
        );
      }
    }
    return stripe.customers.create({
      email: params.email,
      name: params.name,
      metadata: { userId: params.userId },
    });
  }

  async createCheckoutSession(params: {
    customerId: string;
    mode: 'payment' | 'subscription';
    priceId?: string;
    quantity?: number;
    metadata: Record<string, string>;
    successUrl?: string;
    cancelUrl?: string;
    /** Optional Stripe coupon id to apply to the session */
    discountCouponId?: string;
    /** For one-off checkout when no priceId is configured */
    inlinePrice?: {
      name: string;
      description?: string;
      unitAmount: number;
      currency: string;
    };
  }): Promise<Stripe.Checkout.Session> {
    const stripe = this.getClient();
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    if (params.priceId) {
      lineItems.push({ price: params.priceId, quantity: params.quantity ?? 1 });
    } else if (params.inlinePrice) {
      lineItems.push({
        quantity: params.quantity ?? 1,
        price_data: {
          currency: params.inlinePrice.currency,
          unit_amount: params.inlinePrice.unitAmount,
          product_data: {
            name: params.inlinePrice.name,
            description: params.inlinePrice.description,
          },
        },
      });
    } else {
      throw new Error(
        'createCheckoutSession requires either priceId or inlinePrice',
      );
    }

    return stripe.checkout.sessions.create({
      mode: params.mode,
      customer: params.customerId,
      line_items: lineItems,
      payment_method_types: ['card'],
      allow_promotion_codes: !params.discountCouponId,
      discounts: params.discountCouponId ? [{ coupon: params.discountCouponId }] : undefined,
      success_url: params.successUrl ?? this.config.successUrl,
      cancel_url: params.cancelUrl ?? this.config.cancelUrl,
      metadata: params.metadata,
      subscription_data:
        params.mode === 'subscription'
          ? { metadata: params.metadata }
          : undefined,
    });
  }

  async createBillingPortalSession(
    customerId: string,
    returnUrl?: string,
  ): Promise<Stripe.BillingPortal.Session> {
    const stripe = this.getClient();
    return stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl ?? this.config.portalReturnUrl,
    });
  }

  async cancelSubscription(
    stripeSubscriptionId: string,
    atPeriodEnd = true,
  ): Promise<Stripe.Subscription> {
    const stripe = this.getClient();
    if (atPeriodEnd) {
      return stripe.subscriptions.update(stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }
    return stripe.subscriptions.cancel(stripeSubscriptionId);
  }

  /** Verify a webhook signature and return the parsed event. */
  constructEvent(rawBody: Buffer | string, signature: string): Stripe.Event {
    const stripe = this.getClient();
    if (!this.config.webhookSecret) {
      throw new ServiceUnavailableException(
        'Stripe webhook secret is not configured.',
      );
    }
    return stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.config.webhookSecret,
    );
  }

  async ensureProductAndPrice(params: {
    productName: string;
    productId?: string | null;
    priceId?: string | null;
    unitAmount: number;
    currency: string;
    recurring?: { interval: 'month' | 'year' };
    metadata?: Record<string, string>;
  }): Promise<{ productId: string; priceId: string }> {
    const stripe = this.getClient();
    let productId = params.productId ?? '';
    if (!productId) {
      const product = await stripe.products.create({
        name: params.productName,
        metadata: params.metadata,
      });
      productId = product.id;
    }
    if (params.priceId) {
      try {
        const existing = await stripe.prices.retrieve(params.priceId);
        if (existing.active && existing.unit_amount === params.unitAmount) {
          return { productId, priceId: existing.id };
        }
      } catch {
        // fall through and create
      }
    }
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: params.unitAmount,
      currency: params.currency,
      recurring: params.recurring,
      metadata: params.metadata,
    });
    return { productId, priceId: price.id };
  }

  // ---- Coupons & promotion codes ----

  async createCoupon(params: {
    name: string;
    percentOff?: number;
    amountOffCents?: number;
    currency?: string;
    duration: 'ONCE' | 'REPEATING' | 'FOREVER';
    durationMonths?: number;
    maxRedemptions?: number;
    redeemBy?: Date;
  }): Promise<Stripe.Coupon> {
    const stripe = this.getClient();
    return stripe.coupons.create({
      name: params.name,
      percent_off: params.percentOff,
      amount_off: params.amountOffCents,
      currency: params.amountOffCents ? (params.currency ?? this.config.currency).toLowerCase() : undefined,
      duration: params.duration.toLowerCase() as 'once' | 'repeating' | 'forever',
      duration_in_months: params.duration === 'REPEATING' ? params.durationMonths : undefined,
      max_redemptions: params.maxRedemptions,
      redeem_by: params.redeemBy ? Math.floor(params.redeemBy.getTime() / 1000) : undefined,
    });
  }

  async createPromotionCode(params: {
    couponId: string;
    code: string;
    maxRedemptions?: number;
    expiresAt?: Date;
    active?: boolean;
  }): Promise<Stripe.PromotionCode> {
    const stripe = this.getClient();
    return stripe.promotionCodes.create({
      coupon: params.couponId,
      code: params.code,
      max_redemptions: params.maxRedemptions,
      expires_at: params.expiresAt ? Math.floor(params.expiresAt.getTime() / 1000) : undefined,
      active: params.active ?? true,
    });
  }

  async updatePromotionCode(
    id: string,
    params: { active?: boolean },
  ): Promise<Stripe.PromotionCode> {
    const stripe = this.getClient();
    return stripe.promotionCodes.update(id, { active: params.active });
  }

  async refundPayment(params: {
    paymentIntentId?: string;
    checkoutSessionId?: string;
    amountCents?: number;
  }): Promise<Stripe.Refund> {
    const stripe = this.getClient();
    let paymentIntent = params.paymentIntentId;
    if (!paymentIntent && params.checkoutSessionId) {
      const session = await stripe.checkout.sessions.retrieve(params.checkoutSessionId);
      paymentIntent =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;
    }
    if (!paymentIntent) {
      throw new ServiceUnavailableException('No payment intent available for refund.');
    }
    return stripe.refunds.create({
      payment_intent: paymentIntent,
      amount: params.amountCents,
    });
  }
}

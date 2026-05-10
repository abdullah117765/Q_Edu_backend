import { Controller, Headers, HttpCode, Logger, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { BillingService } from './billing.service';
import { StripeService } from '../stripe/stripe.service';

/**
 * Stripe webhook receiver.
 * NOTE: requires the raw request body. main.ts mounts express.raw() for this path.
 */
@ApiExcludeController()
@Controller('billing/webhook')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly stripe: StripeService,
    private readonly billing: BillingService,
  ) {}

  @Post()
  @SkipThrottle()
  @HttpCode(200)
  async handle(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      this.logger.warn('Webhook received without stripe-signature header');
      return { received: false };
    }
    const raw = req.rawBody ?? (req.body as unknown as Buffer);
    if (!raw || !(raw instanceof Buffer)) {
      this.logger.error('Webhook raw body is missing - check express.raw mounting');
      return { received: false };
    }
    let event;
    try {
      event = this.stripe.constructEvent(raw, signature);
    } catch (err) {
      this.logger.warn(`Webhook signature verification failed: ${(err as Error).message}`);
      return { received: false };
    }
    try {
      await this.billing.handleStripeEvent(event);
    } catch (err) {
      this.logger.error(`Error handling event ${event.id}: ${(err as Error).message}`);
      // Return 500 so Stripe retries
      throw err;
    }
    return { received: true };
  }
}

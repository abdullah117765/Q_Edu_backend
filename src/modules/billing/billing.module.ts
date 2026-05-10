import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { CouponsService } from './coupons.service';
import { StripeWebhookController } from './stripe-webhook.controller';

@Module({
  imports: [PrismaModule],
  controllers: [BillingController, StripeWebhookController],
  providers: [BillingService, CouponsService],
  exports: [BillingService, CouponsService],
})
export class BillingModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SuperAdminBootstrap } from './bootstrap/super-admin.bootstrap';
import { WelcomeCouponBootstrap } from './bootstrap/welcome-coupon.bootstrap';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { AcademiesModule } from './modules/academies/academies.module';
import { AcademySettingsModule } from './modules/academy-settings/academy-settings.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { ClassesModule } from './modules/classes/classes.module';
import { ContactMessagesModule } from './modules/contact-messages/contact-messages.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MailModule } from './modules/mail/mail.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PlatformSettingsModule } from './modules/platform-settings/platform-settings.module';
import { RecordingsModule } from './modules/recordings/recordings.module';
import { ResourcesModule } from './modules/resources/resources.module';
import { StripeModule } from './modules/stripe/stripe.module';
import { UsersModule } from './modules/users/users.module';
import { ZoomCreditsModule } from './modules/zoom-credits/zoom-credits.module';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        abortEarly: false,
      },
    }),
    PrismaModule,
    StorageModule,
    MailModule,
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 60,
      },
    ]),
    AuthModule,
    UsersModule,
    ClassesModule,
    ContactMessagesModule,
    ZoomCreditsModule,
    DashboardModule,
    ResourcesModule,
    RecordingsModule,
    PaymentsModule,
    PlatformSettingsModule,
    AcademySettingsModule,
    AcademiesModule,
    StripeModule,
    BillingModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    SuperAdminBootstrap,
    WelcomeCouponBootstrap,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

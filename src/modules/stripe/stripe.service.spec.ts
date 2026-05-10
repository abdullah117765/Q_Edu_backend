import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { StripeService } from './stripe.service';

describe('StripeService', () => {
  const buildService = async (overrides: Record<string, unknown> = {}) => {
    const configValues: Record<string, unknown> = {
      stripe: {
        enabled: false,
        secretKey: '',
        publishableKey: '',
        webhookSecret: '',
        apiVersion: '2024-06-20',
        currency: 'usd',
        platformFeePercent: 10,
        successUrl: '',
        cancelUrl: '',
        portalReturnUrl: '',
      },
      ...overrides,
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: { get: (key: string) => configValues[key] },
        },
      ],
    }).compile();
    const svc = moduleRef.get(StripeService);
    svc.onModuleInit?.();
    return svc;
  };

  describe('platform fee math', () => {
    it('computes 10% fee on whole-dollar amounts', async () => {
      const svc = await buildService();
      expect(svc.calculatePlatformFeeCents(1000)).toBe(100);
      expect(svc.calculatePlatformFeeCents(4500)).toBe(450);
      expect(svc.calculatePlatformFeeCents(0)).toBe(0);
    });

    it('rounds half-cent values consistently', async () => {
      const svc = await buildService();
      // 1234 * 10% = 123.4 -> round to 123
      expect(svc.calculatePlatformFeeCents(1234)).toBe(123);
      // 1235 * 10% = 123.5 -> Math.round goes to 124
      expect(svc.calculatePlatformFeeCents(1235)).toBe(124);
    });

    it('respects a custom configured percent (clamped 0-100)', async () => {
      const svc = await buildService({
        stripe: {
          enabled: false,
          secretKey: '',
          publishableKey: '',
          webhookSecret: '',
          apiVersion: '2024-06-20',
          currency: 'usd',
          platformFeePercent: 25,
          successUrl: '',
          cancelUrl: '',
          portalReturnUrl: '',
        },
      });
      expect(svc.calculatePlatformFeeCents(2000)).toBe(500);
    });

    it('splits gross into gross/fee/net consistently', async () => {
      const svc = await buildService();
      const split = svc.splitAmountCents(10000);
      expect(split.gross).toBe(10000);
      expect(split.fee).toBe(1000);
      expect(split.net).toBe(9000);
      expect(split.feePercent).toBe(10);
      expect(split.fee + split.net).toBe(split.gross);
    });
  });

  describe('configuration flags', () => {
    it('reports disabled when no secret key is provided', async () => {
      const svc = await buildService();
      expect(svc.isEnabled()).toBe(false);
    });
  });
});

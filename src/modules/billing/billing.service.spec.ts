import { SubscriptionInterval, SubscriptionStatus } from '@prisma/client';
import { BillingService } from './billing.service';

describe('BillingService', () => {
  const prismaMock = {
    payment: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    subscription: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    stripeWebhookEvent: {
      create: jest.fn(),
      update: jest.fn(),
    },
  } as any;

  const stripeMock = {
    getConfig: jest
      .fn()
      .mockReturnValue({ platformFeePercent: 10, currency: 'usd' }),
  } as any;

  const couponsMock = {} as any;
  const notificationsMock = { notify: jest.fn() } as any;

  let service: BillingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BillingService(
      prismaMock,
      stripeMock,
      couponsMock,
      notificationsMock,
    );
  });

  it('short-circuits duplicate webhook events (idempotency)', async () => {
    prismaMock.stripeWebhookEvent.create.mockRejectedValueOnce({
      code: 'P2002',
    });

    await expect(
      service.handleStripeEvent({
        id: 'evt_duplicate',
        type: 'invoice.payment_succeeded',
        data: { object: {} },
      } as any),
    ).resolves.toBeUndefined();

    expect(prismaMock.stripeWebhookEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'evt_duplicate',
          type: 'invoice.payment_succeeded',
        }),
      }),
    );
    expect(prismaMock.stripeWebhookEvent.update).not.toHaveBeenCalled();
  });

  it('returns aggregated analytics and builds time series buckets', async () => {
    prismaMock.payment.aggregate.mockResolvedValueOnce({
      _sum: { amount: 1200, platformFeeAmount: 120, netAmount: 1080 },
      _count: { _all: 4 },
    });
    prismaMock.payment.groupBy
      .mockResolvedValueOnce([
        {
          provider: 'stripe',
          _sum: { amount: 1200, platformFeeAmount: 120 },
          _count: { _all: 4 },
        },
      ])
      .mockResolvedValueOnce([
        {
          packageId: 'pkg_1',
          _sum: { amount: 800, platformFeeAmount: 80 },
          _count: { _all: 2 },
        },
      ])
      .mockResolvedValueOnce([
        {
          subscriptionId: 'sub_1',
          _sum: { amount: 400, platformFeeAmount: 40 },
          _count: { _all: 2 },
        },
      ]);
    prismaMock.payment.findMany
      .mockResolvedValueOnce([{ id: 'pay_1' }])
      .mockResolvedValueOnce([
        {
          createdAt: new Date('2026-05-01T10:00:00.000Z'),
          amount: 100,
          platformFeeAmount: 10,
          netAmount: 90,
        },
        {
          createdAt: new Date('2026-05-02T10:00:00.000Z'),
          amount: 200,
          platformFeeAmount: 20,
          netAmount: 180,
        },
      ]);
    prismaMock.subscription.count.mockResolvedValueOnce(3);
    prismaMock.subscription.findMany.mockResolvedValueOnce([
      { plan: { priceCents: 1200, interval: SubscriptionInterval.MONTHLY } },
      { plan: { priceCents: 2400, interval: SubscriptionInterval.YEARLY } },
    ]);

    const result = await service.getAdminAnalytics({
      from: new Date('2026-05-01T00:00:00.000Z'),
      to: new Date('2026-05-03T00:00:00.000Z'),
      interval: 'day',
      provider: 'stripe',
    });

    expect(result.totals.gross).toBe(1200);
    expect(result.totals.platformFee).toBe(120);
    expect(result.totals.net).toBe(1080);
    expect(result.totals.transactionCount).toBe(4);
    expect(result.activeSubscriptions).toBe(3);
    expect(result.mrrCents).toBe(1400);
    expect(result.byProvider).toHaveLength(1);
    expect(result.byPackage).toHaveLength(1);
    expect(result.byPlan).toHaveLength(1);
    expect(result.timeSeries.length).toBeGreaterThan(0);
    expect(result.timeSeries[0]).toEqual(
      expect.objectContaining({
        label: expect.any(String),
        gross: expect.any(Number),
        platformFee: expect.any(Number),
        net: expect.any(Number),
        count: expect.any(Number),
      }),
    );
  });

  it('maps Stripe subscription statuses to internal enums', () => {
    expect((service as any).mapSubStatus('active')).toBe(
      SubscriptionStatus.ACTIVE,
    );
    expect((service as any).mapSubStatus('trialing')).toBe(
      SubscriptionStatus.TRIALING,
    );
    expect((service as any).mapSubStatus('past_due')).toBe(
      SubscriptionStatus.PAST_DUE,
    );
    expect((service as any).mapSubStatus('canceled')).toBe(
      SubscriptionStatus.CANCELED,
    );
    expect((service as any).mapSubStatus('incomplete')).toBe(
      SubscriptionStatus.INCOMPLETE,
    );
    expect((service as any).mapSubStatus('incomplete_expired')).toBe(
      SubscriptionStatus.INCOMPLETE_EXPIRED,
    );
    expect((service as any).mapSubStatus('unpaid')).toBe(
      SubscriptionStatus.UNPAID,
    );
  });
});

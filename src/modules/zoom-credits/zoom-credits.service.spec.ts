import { BadRequestException } from '@nestjs/common';
import { ZoomCreditTransactionType } from '@prisma/client';
import { ZoomCreditOperation } from './dto/create-zoom-credit-transaction.dto';
import { ZoomCreditsService } from './zoom-credits.service';

describe('ZoomCreditsService', () => {
  const txMock = {
    zoomCreditBalance: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
    zoomCreditTransaction: {
      create: jest.fn(),
    },
    zoomCreditAuditLog: {
      create: jest.fn(),
      createMany: jest.fn(),
    },
  };

  const prismaMock = {
    $transaction: jest.fn(),
    zoomCreditBalance: { upsert: jest.fn() },
    zoomCreditTransaction: {
      count: jest.fn(),
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
  };

  const paymentsServiceMock = {
    refund: jest.fn(),
    chargeForCredits: jest.fn(),
  };

  let service: ZoomCreditsService;

  beforeEach(() => {
    jest.resetAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: any) =>
      callback(txMock),
    );
    service = new ZoomCreditsService(
      prismaMock as unknown as any,
      paymentsServiceMock as unknown as any,
    );
  });

  it('credits balance when operation is credit', async () => {
    const now = new Date();
    txMock.zoomCreditBalance.upsert.mockResolvedValueOnce({
      userId: 'user-1',
      balance: 10,
      updatedAt: now,
    });
    txMock.zoomCreditBalance.update.mockResolvedValueOnce({});
    txMock.zoomCreditTransaction.create.mockResolvedValueOnce({
      id: 'tx-1',
      userId: 'user-1',
      relatedUserId: null,
      classId: null,
      type: ZoomCreditTransactionType.CREDIT,
      amount: 5,
      runningBalance: 15,
      reason: 'Manual credit',
      metadata: null,
      createdAt: now,
    });
    txMock.zoomCreditAuditLog.create.mockResolvedValueOnce({});

    const result = await service.adjustCredits(
      {
        userId: 'user-1',
        operation: ZoomCreditOperation.CREDIT,
        amount: 5,
        reason: 'Manual credit',
      },
      'actor-1',
    );

    expect(txMock.zoomCreditBalance.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { balance: 15 },
    });
    expect(txMock.zoomCreditTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          amount: 5,
          runningBalance: 15,
        }),
      }),
    );
    expect(result.runningBalance).toBe(15);
  });

  it('throws when debiting more than available', async () => {
    txMock.zoomCreditBalance.upsert.mockResolvedValueOnce({
      userId: 'user-1',
      balance: 3,
      updatedAt: new Date(),
    });

    await expect(
      service.adjustCredits(
        {
          userId: 'user-1',
          operation: ZoomCreditOperation.DEBIT,
          amount: 5,
        },
        'actor-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(txMock.zoomCreditTransaction.create).not.toHaveBeenCalled();
  });
});

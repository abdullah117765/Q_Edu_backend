import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role as PrismaRole } from '@prisma/client';
import { ClassesService } from './classes.service';
import { ClassStatus } from './entities/class-status.enum';

describe('ClassesService', () => {
  const prismaMock = {
    user: { findUnique: jest.fn() },
    academy: {
      findUnique: jest.fn().mockResolvedValue({ ownerId: 'owner-1' }),
    },
    academyMembership: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ status: 'APPROVED', role: 'TEACHER' }),
      findMany: jest.fn().mockResolvedValue([{ academyId: 'academy-1' }]),
    },
    class: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    classParticipant: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const zoomServiceMock = {
    createMeeting: jest.fn(),
    updateMeeting: jest.fn(),
    deleteMeeting: jest.fn(),
    getMeetingParticipants: jest.fn(),
  };

  const zoomCreditsServiceMock = {
    adjustCredits: jest.fn(),
    getSummary: jest.fn(),
  };

  const platformSettingsServiceMock = {
    isZoomEnabled: jest.fn().mockResolvedValue(true),
    getSettings: jest.fn().mockResolvedValue({ zoomEnabled: true }),
  };

  const configServiceMock = {
    get: jest.fn().mockReturnValue(1),
  };

  let service: ClassesService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (input: unknown) => {
      if (typeof input === 'function') {
        return (input as (tx: typeof prismaMock) => Promise<unknown>)(prismaMock);
      }
      return Promise.all(input as Array<Promise<unknown>>);
    });
    configServiceMock.get.mockReturnValue(1);
    service = new ClassesService(
      prismaMock as unknown as any,
      zoomServiceMock as unknown as any,
      zoomCreditsServiceMock as unknown as any,
      platformSettingsServiceMock as unknown as any,
      configServiceMock as unknown as any,
    );
  });

  describe('create', () => {
    it('throws when teacher is not found', async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.create({
          title: 'Test',
          description: undefined,
          teacherId: 'teacher-1',
          academyId: 'academy-1',
          scheduledStart: new Date().toISOString(),
          scheduledEnd: new Date(Date.now() + 3600000).toISOString(),
          timezone: 'UTC',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'teacher-1' },
      });
      expect(zoomServiceMock.createMeeting).not.toHaveBeenCalled();
    });

    it('uses the configured backend credit cost when scheduling', async () => {
      configServiceMock.get.mockReturnValueOnce(4);
      service = new ClassesService(
        prismaMock as unknown as any,
        zoomServiceMock as unknown as any,
        zoomCreditsServiceMock as unknown as any,
        platformSettingsServiceMock as unknown as any,
        configServiceMock as unknown as any,
      );

      const scheduledStart = new Date('2026-05-12T10:00:00.000Z');
      const scheduledEnd = new Date('2026-05-12T11:00:00.000Z');
      prismaMock.user.findUnique.mockResolvedValueOnce({
        id: 'teacher-1',
        email: 'teacher@example.com',
        role: PrismaRole.TEACHER,
        status: 'APPROVED',
        zoomUserId: null,
      });
      prismaMock.academy.findUnique.mockResolvedValueOnce({
        id: 'academy-1',
        ownerId: 'owner-1',
      });
      zoomCreditsServiceMock.getSummary.mockResolvedValueOnce({
        balance: 10,
      });
      zoomServiceMock.createMeeting.mockResolvedValueOnce({
        id: 123456789,
        host_id: 'host-1',
        join_url: 'join-url',
        start_url: 'start-url',
        password: null,
        uuid: 'uuid',
      });
      prismaMock.class.create.mockResolvedValueOnce({ id: 'class-1' });
      zoomCreditsServiceMock.adjustCredits.mockResolvedValueOnce({});
      prismaMock.class.findUnique.mockResolvedValueOnce({
        id: 'class-1',
        title: 'Configured Cost Class',
        description: null,
        academyId: 'academy-1',
        teacherId: 'teacher-1',
        scheduledStart,
        scheduledEnd,
        durationMinutes: 60,
        timezone: 'UTC',
        creditsConsumed: 4,
        zoomMeetingId: '123456789',
        zoomHostId: 'host-1',
        zoomJoinUrl: 'join-url',
        zoomStartUrl: 'start-url',
        zoomPassword: null,
        zoomUuid: 'uuid',
        metadata: null,
        status: ClassStatus.UPCOMING,
        createdAt: new Date(),
        updatedAt: new Date(),
        teacher: {
          id: 'teacher-1',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'teacher@example.com',
        },
        participants: [],
        _count: { participants: 0 },
      });

      await service.create(
        {
          title: 'Configured Cost Class',
          description: undefined,
          teacherId: 'teacher-1',
          academyId: 'academy-1',
          scheduledStart: scheduledStart.toISOString(),
          scheduledEnd: scheduledEnd.toISOString(),
          timezone: 'UTC',
          creditsConsumed: 999,
        },
        'admin-1',
        PrismaRole.SUPER_ADMIN,
      );

      expect(prismaMock.class.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            creditsConsumed: 4,
          }),
        }),
      );
      expect(zoomCreditsServiceMock.adjustCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 4,
          userId: 'teacher-1',
          classId: 'class-1',
        }),
        'admin-1',
      );
    });

    it('throws when scheduledEnd is before scheduledStart', async () => {
      await expect(
        service.create({
          title: 'Test',
          description: undefined,
          teacherId: 'teacher-1',
          academyId: 'academy-1',
          scheduledStart: new Date().toISOString(),
          scheduledEnd: new Date(Date.now() - 3600000).toISOString(),
          timezone: 'UTC',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    const baseClass = {
      id: 'class-1',
      title: 'Existing class',
      description: null,
      academyId: 'academy-1',
      teacherId: 'teacher-1',
      scheduledStart: new Date(),
      scheduledEnd: new Date(Date.now() + 3600000),
      durationMinutes: 60,
      timezone: 'UTC',
      creditsConsumed: 5,
      zoomMeetingId: '123456789',
      zoomHostId: 'host',
      zoomJoinUrl: 'join-url',
      zoomStartUrl: 'start-url',
      zoomPassword: null,
      zoomUuid: 'uuid',
      metadata: null,
      status: ClassStatus.UPCOMING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      prismaMock.class.findUnique.mockReset();
      prismaMock.class.findUnique.mockResolvedValueOnce(baseClass);
      prismaMock.class.findUnique.mockResolvedValueOnce({
        ...baseClass,
        creditsConsumed: 15,
        teacher: {
          id: 'teacher-1',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'teacher@example.com',
        },
        participants: [],
        _count: { participants: 0 },
      });

      zoomServiceMock.updateMeeting.mockResolvedValue(undefined);

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'teacher-1',
        role: PrismaRole.TEACHER,
        status: 'APPROVED',
      });

      prismaMock.class.update.mockResolvedValue({
        id: baseClass.id,
        title: baseClass.title,
        teacherId: baseClass.teacherId,
        scheduledStart: baseClass.scheduledStart,
        creditsConsumed: 15,
        zoomMeetingId: baseClass.zoomMeetingId,
      });
    });

    it('deducts additional credits when creditsConsumed increases', async () => {
      zoomCreditsServiceMock.adjustCredits.mockResolvedValue({});

      await service.update(
        'class-1',
        {
          creditsConsumed: 15,
          scheduledStart: new Date(
            baseClass.scheduledStart.getTime() + 60000,
          ).toISOString(),
          scheduledEnd: new Date(
            baseClass.scheduledEnd.getTime() + 60000,
          ).toISOString(),
        },
        'actor-1',
        PrismaRole.SUPER_ADMIN,
      );

      expect(zoomCreditsServiceMock.adjustCredits).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 10,
          userId: 'teacher-1',
          classId: 'class-1',
        }),
        'actor-1',
      );
      expect(zoomServiceMock.updateMeeting).toHaveBeenCalledTimes(1);
    });
  });

  describe('cancel', () => {
    const baseClass = {
      id: 'class-1',
      title: 'Upcoming class',
      description: null,
      academyId: 'academy-1',
      teacherId: 'teacher-1',
      scheduledStart: new Date(Date.now() + 3600000),
      scheduledEnd: new Date(Date.now() + 7200000),
      durationMinutes: 60,
      timezone: 'UTC',
      creditsConsumed: 1,
      zoomMeetingId: '123456789',
      zoomHostId: 'host',
      zoomJoinUrl: 'join-url',
      zoomStartUrl: 'start-url',
      zoomPassword: null,
      zoomUuid: 'uuid',
      metadata: null,
      status: ClassStatus.UPCOMING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('cancels a teacher-owned class with a reason', async () => {
      prismaMock.class.findUnique.mockResolvedValueOnce(baseClass);
      prismaMock.class.findUnique.mockResolvedValueOnce({
        ...baseClass,
        status: ClassStatus.CANCELLED,
        metadata: {
          cancellation: {
            reason: 'Teacher unavailable',
            cancelledBy: 'teacher-1',
          },
        },
        teacher: {
          id: 'teacher-1',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'teacher@example.com',
        },
        participants: [],
        _count: { participants: 0 },
      });

      await service.cancel(
        'class-1',
        { reason: 'Teacher unavailable' },
        'teacher-1',
        PrismaRole.TEACHER,
      );

      expect(prismaMock.class.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'class-1' },
          data: expect.objectContaining({
            status: ClassStatus.CANCELLED,
            zoomMeetingId: null,
            zoomJoinUrl: null,
            zoomStartUrl: null,
            metadata: expect.objectContaining({
              cancellation: expect.objectContaining({
                reason: 'Teacher unavailable',
                cancelledBy: 'teacher-1',
              }),
            }),
          }),
        }),
      );
      expect(zoomServiceMock.deleteMeeting).toHaveBeenCalledWith('123456789');
    });
  });

  describe('remove', () => {
    const baseClass = {
      id: 'class-1',
      title: 'Class',
      description: null,
      academyId: 'academy-1',
      teacherId: 'teacher-1',
      scheduledStart: new Date(Date.now() + 3600000),
      scheduledEnd: new Date(Date.now() + 7200000),
      durationMinutes: 60,
      timezone: 'UTC',
      creditsConsumed: 1,
      zoomMeetingId: '123456789',
      zoomHostId: 'host',
      zoomJoinUrl: 'join-url',
      zoomStartUrl: 'start-url',
      zoomPassword: null,
      zoomUuid: 'uuid',
      metadata: null,
      status: ClassStatus.UPCOMING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('rejects clearing a future class before it is cancelled', async () => {
      prismaMock.class.findUnique.mockResolvedValueOnce(baseClass);

      await expect(
        service.remove('class-1', 'teacher-1', PrismaRole.TEACHER),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(prismaMock.class.delete).not.toHaveBeenCalled();
    });

    it('clears an old class even if its status was not updated', async () => {
      prismaMock.class.findUnique.mockResolvedValueOnce({
        ...baseClass,
        scheduledStart: new Date(Date.now() - 7200000),
        scheduledEnd: new Date(Date.now() - 3600000),
      });

      await service.remove('class-1', 'teacher-1', PrismaRole.TEACHER);

      expect(prismaMock.class.delete).toHaveBeenCalledWith({
        where: { id: 'class-1' },
      });
    });
  });
});

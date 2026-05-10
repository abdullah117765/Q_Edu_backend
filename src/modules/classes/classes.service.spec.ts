import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role as PrismaRole } from '@prisma/client';
import { ClassesService } from './classes.service';
import { ClassStatus } from './entities/class-status.enum';

describe('ClassesService', () => {
  const prismaMock = {
    user: { findUnique: jest.fn() },
    academy: { findUnique: jest.fn().mockResolvedValue({ ownerId: 'owner-1' }) },
    academyMembership: {
      findUnique: jest.fn().mockResolvedValue({ status: 'APPROVED', role: 'TEACHER' }),
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
  };

  const platformSettingsServiceMock = {
    isZoomEnabled: jest.fn().mockResolvedValue(true),
    getSettings: jest.fn().mockResolvedValue({ zoomEnabled: true }),
  };

  let service: ClassesService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ClassesService(
      prismaMock as unknown as any,
      zoomServiceMock as unknown as any,
      zoomCreditsServiceMock as unknown as any,
      platformSettingsServiceMock as unknown as any,
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

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: 'teacher-1' } });
      expect(zoomServiceMock.createMeeting).not.toHaveBeenCalled();
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
        teacher: { id: 'teacher-1', firstName: 'Jane', lastName: 'Doe', email: 'teacher@example.com' },
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
          scheduledStart: new Date(baseClass.scheduledStart.getTime() + 60000).toISOString(),
          scheduledEnd: new Date(baseClass.scheduledEnd.getTime() + 60000).toISOString(),
        },
        'actor-1',
        PrismaRole.SUPER_ADMIN,
      );

      expect(zoomCreditsServiceMock.adjustCredits).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 10, userId: 'teacher-1', classId: 'class-1' }),
        'actor-1',
      );
      expect(zoomServiceMock.updateMeeting).toHaveBeenCalledTimes(1);
    });
  });
});

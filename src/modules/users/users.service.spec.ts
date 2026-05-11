import { ConflictException } from '@nestjs/common';
import { Role } from './entities/role.enum';
import { UserStatus } from './entities/user-status.enum';
import { UsersService } from './users.service';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

describe('UsersService - onboarding', () => {
  const prismaMock = {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest.fn(),
  };

  const academiesServiceMock = {
    ensureAcademyForOwner: jest.fn(),
    getAccessibleAcademyScope: jest
      .fn()
      .mockResolvedValue({ unlimited: true, academyIds: [] }),
  };

  const storageMock = {
    saveFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  const notificationsMock = {
    notify: jest.fn(),
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation(
      async (queries: Promise<unknown>[]) => Promise.all(queries),
    );
    prismaMock.user.count.mockResolvedValue(0);
    prismaMock.user.groupBy.mockResolvedValue([]);
    service = new UsersService(
      prismaMock as unknown as any,
      academiesServiceMock as unknown as any,
      storageMock as unknown as any,
      notificationsMock as unknown as any,
    );
  });

  const baseUser = {
    id: 'user-1',
    email: 'student@example.com',
    password: 'hashed-password',
    firstName: 'Student',
    lastName: null,
    phoneNumber: '+123456789',
    role: Role.STUDENT,
    status: UserStatus.PENDING,
    rejectionReason: null,
    isActive: false,
    zoomUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('creates a student with enforced student role', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(null);
    prismaMock.user.create.mockResolvedValueOnce(baseUser);

    const result = await service.createStudent({
      email: 'student@example.com',
      password: 'StrongPass123',
      firstName: 'Student',
      phoneNumber: '+123456789',
    });

    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'student@example.com',
        role: Role.STUDENT,
      }),
    });
    expect(result.role).toBe(Role.STUDENT);
    expect(result).not.toHaveProperty('password');
  });

  it('throws when student email already exists', async () => {
    prismaMock.user.findUnique.mockResolvedValueOnce(baseUser);

    await expect(
      service.createStudent({
        email: baseUser.email,
        password: 'StrongPass123',
        firstName: 'Student',
        phoneNumber: '+123456789',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists students with status and search filters applied', async () => {
    prismaMock.user.count.mockResolvedValueOnce(1);
    prismaMock.user.findMany.mockResolvedValueOnce([baseUser]);

    const result = await service.findStudents({
      page: 1,
      limit: 10,
      status: UserStatus.PENDING,
      search: 'Student',
    });

    expect(prismaMock.user.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        role: Role.STUDENT,
        status: UserStatus.PENDING,
      }),
    });
    expect(prismaMock.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: Role.STUDENT }),
        skip: 0,
        take: 10,
      }),
    );
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(result.meta.totalPages).toBe(1);
  });

  describe('findAll directory query', () => {
    beforeEach(() => {
      prismaMock.$transaction.mockImplementation(async (queries: any) => {
        if (typeof queries === 'function') return queries({});
        return [0, [], [], 0];
      });
    });

    it('passes status and search to where clause for super admin', async () => {
      prismaMock.$transaction.mockResolvedValueOnce([
        1,
        [{ ...baseUser, ownedAcademy: null, academyMemberships: [] }],
        [{ status: UserStatus.PENDING, _count: { _all: 1 } }],
        0,
      ]);

      const result = await service.findAll(
        { page: 1, limit: 25, status: UserStatus.PENDING, search: 'jane' },
        { id: 'super-1', role: Role.SUPER_ADMIN as any },
      );

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });

    it('returns empty when scoped role has no accessible academies', async () => {
      academiesServiceMock.getAccessibleAcademyScope.mockResolvedValueOnce({
        unlimited: false,
        academyIds: [],
      });

      const result = await service.findAll(
        { page: 1, limit: 25 },
        { id: 'owner-1', role: Role.ACADEMY_OWNER as any },
      );

      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });
});

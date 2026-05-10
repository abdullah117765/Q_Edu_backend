import { UsersController } from './users.controller';
import { Role } from './entities/role.enum';
import { UserStatus } from './entities/user-status.enum';

describe('UsersController', () => {
  const usersServiceMock = {
    findStudents: jest.fn(),
    findTeachers: jest.fn(),
    findAll: jest.fn(),
  };

  const controller = new UsersController(usersServiceMock as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseStudent = {
    id: 's-1',
    email: 'student@example.com',
    firstName: 'Student',
    lastName: 'One',
    role: Role.STUDENT,
    status: UserStatus.APPROVED,
  };

  describe('findStudents', () => {
    it('masks emails for TEACHER callers', async () => {
      usersServiceMock.findStudents.mockResolvedValueOnce({
        data: [{ ...baseStudent }],
        meta: { total: 1, currentPage: 1, totalPages: 1, nextPage: null, previousPage: null },
        summary: {},
      });

      const teacher = { id: 't-1', role: Role.TEACHER, email: 't@x.com' };
      const result = await controller.findStudents(
        { page: 1, limit: 25 } as any,
        { user: teacher } as any,
      );

      expect(usersServiceMock.findStudents).toHaveBeenCalledWith(
        expect.objectContaining({ status: UserStatus.APPROVED }),
        { id: 't-1', role: Role.TEACHER },
      );
      expect(result.data[0].email).toBe('s***@example.com');
    });

    it('does not mask emails for SUPER_ADMIN callers', async () => {
      usersServiceMock.findStudents.mockResolvedValueOnce({
        data: [{ ...baseStudent }],
        meta: { total: 1, currentPage: 1, totalPages: 1, nextPage: null, previousPage: null },
        summary: {},
      });

      const admin = { id: 'a-1', role: Role.SUPER_ADMIN, email: 'a@x.com' };
      const result = await controller.findStudents(
        { page: 1, limit: 25 } as any,
        { user: admin } as any,
      );

      expect(result.data[0].email).toBe('student@example.com');
    });

    it('handles single character local part safely', async () => {
      usersServiceMock.findStudents.mockResolvedValueOnce({
        data: [{ ...baseStudent, email: 'a@example.com' }],
        meta: { total: 1, currentPage: 1, totalPages: 1, nextPage: null, previousPage: null },
        summary: {},
      });
      const teacher = { id: 't-1', role: Role.TEACHER, email: 't@x.com' };
      const result = await controller.findStudents(
        { page: 1, limit: 25 } as any,
        { user: teacher } as any,
      );
      expect(result.data[0].email).toBe('a***@example.com');
    });
  });
});

import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AcademyMembershipStatus, Prisma, Role as PrismaRole, UserStatus as PrismaUserStatus, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UploadedFile } from '../../common/interfaces/uploaded-file.interface';

import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { PaginatedResponse } from '../../common/interfaces/pagination.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { AcademiesService } from '../academies/academies.service';
import { StorageService } from '../../storage/storage.service';
import { AdminsQueryDto } from './dto/admins-query.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { StudentsQueryDto } from './dto/students-query.dto';
import { TeachersQueryDto } from './dto/teachers-query.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { Role } from './entities/role.enum';
import { UserStatus } from './entities/user-status.enum';
import { UserEntity } from './entities/user.entity';

const PASSWORD_SALT_ROUNDS = 12;

type RoleQueryDto = AdminsQueryDto | TeachersQueryDto | StudentsQueryDto;

type UsersSummary = {
  approved: number;
  pending: number;
  rejected: number;
  inactive: number;
};

type UsersPaginatedResponse = PaginatedResponse<UserEntity> & { summary: UsersSummary };

type CurrentUserContext = {
  id: string;
  role: Role;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly academiesService: AcademiesService,
    private readonly storage: StorageService,
  ) {}

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email address is already in use.');
    }

    const role = dto.role ?? Role.STUDENT;
    if (role === Role.SUPER_ADMIN) {
      const superAdminCount = await this.prisma.user.count({ where: { role: PrismaRole.SUPER_ADMIN } });
      if (superAdminCount > 0) {
        throw new ConflictException('A super admin already exists.');
      }
    }

    const hashedPassword = await this.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phoneNumber: dto.phoneNumber,
        role,
        status: role === Role.SUPER_ADMIN ? UserStatus.APPROVED : undefined,
        isActive: false,
      },
    });

    if (role === Role.ACADEMY_OWNER) {
      try {
        await this.academiesService.ensureAcademyForOwner({
          ownerId: user.id,
          name: dto.academyName,
          description: dto.academyDescription,
        });
      } catch (error) {
        this.logger.error(`Failed to provision academy for owner ${user.id}: ${(error as Error).message}`);
        await this.prisma.user.delete({ where: { id: user.id } });
        throw error;
      }
    }

    return this.toEntity(user);
  }

  async createAdmin(dto: CreateAdminDto): Promise<UserEntity> {
    return this.create({ ...(dto as CreateUserDto), role: Role.ACADEMY_OWNER });
  }

  async createTeacher(dto: CreateTeacherDto): Promise<UserEntity> {
    return this.create({ ...(dto as CreateUserDto), role: Role.TEACHER });
  }

  async createStudent(dto: CreateStudentDto): Promise<UserEntity> {
    return this.create({ ...(dto as CreateUserDto), role: Role.STUDENT });
  }

  async findAll(
    pagination: PaginationQueryDto,
    currentUser?: CurrentUserContext,
  ): Promise<UsersPaginatedResponse> {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const { where, emptyResult } = await this.buildScopedWhere({}, currentUser);
    if (emptyResult) {
      return this.emptyPaginatedResponse(page);
    }

    const [total, users, statusGroups, inactiveCount] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.groupBy({
        by: ['status'],
        where,
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.user.count({
        where: {
          AND: [where, { isActive: false }],
        },
      }),
    ]);

    const data = users.map((user) => this.toEntity(user));
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const statusCountMap = this.extractStatusCounts(statusGroups);

    return {
      data,
      meta: {
        total,
        count: data.length,
        nextPage: page < totalPages ? page + 1 : null,
        previousPage: page > 1 ? page - 1 : null,
        currentPage: page,
        totalPages,
      },
      summary: this.buildSummary(statusCountMap, inactiveCount),
    };
  }

  async findAdmins(
    query: AdminsQueryDto,
    currentUser?: CurrentUserContext,
  ): Promise<UsersPaginatedResponse> {
    return this.findByRole(Role.ACADEMY_OWNER, query, currentUser);
  }

  async findTeachers(
    query: TeachersQueryDto,
    currentUser?: CurrentUserContext,
  ): Promise<UsersPaginatedResponse> {
    return this.findByRole(Role.TEACHER, query, currentUser);
  }

  async findStudents(
    query: StudentsQueryDto,
    currentUser?: CurrentUserContext,
  ): Promise<UsersPaginatedResponse> {
    return this.findByRole(Role.STUDENT, query, currentUser);
  }

  async findOne(id: string, currentUser?: CurrentUserContext): Promise<UserEntity> {
    const user = await this.fetchUserWithAssociations(id);
    if (!user) {
      throw new NotFoundException('User with the specified id was not found.');
    }

    if (currentUser && currentUser.id !== id && currentUser.role !== Role.SUPER_ADMIN) {
      const scope = await this.academiesService.getAccessibleAcademyScope(
        currentUser.id,
        currentUser.role as unknown as PrismaRole,
      );

      if (!scope.unlimited) {
        const approvedMembershipAcademyIds = (user.academyMemberships ?? [])
          .filter((membership) => membership.status === AcademyMembershipStatus.APPROVED)
          .map((membership) => membership.academyId);
        const ownedAcademyIds = user.ownedAcademy ? [user.ownedAcademy.id] : [];
        const accessibleAcademyIds = new Set([...approvedMembershipAcademyIds, ...ownedAcademyIds]);
        const hasOverlap = scope.academyIds.some((academyId) => accessibleAcademyIds.has(academyId));

        if (!hasOverlap) {
          throw new ForbiddenException('You are not authorized to view this user.');
        }
      }
    }

    return this.toEntity(user);
  }

  async getOwnProfile(userId: string): Promise<UserEntity> {
    const user = await this.fetchUserWithAssociations(userId);
    if (!user) {
      throw new NotFoundException('User with the specified id was not found.');
    }

    return this.toEntity(user);
  }

  async updateOwnProfile(userId: string, dto: UpdateProfileDto): Promise<UserEntity> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User with the specified id was not found.');
    }

    const data: Prisma.UserUpdateInput = {};

    if (dto.firstName !== undefined) {
      const firstName = dto.firstName.trim();
      if (!firstName) {
        throw new BadRequestException('First name cannot be empty.');
      }
      data.firstName = firstName;
    }

    if (dto.lastName !== undefined) {
      data.lastName = this.normaliseNullableString(dto.lastName);
    }

    if (dto.phoneNumber !== undefined) {
      const normalisedPhone = this.normaliseNullableString(dto.phoneNumber);
      if (!normalisedPhone) {
        throw new BadRequestException('Phone number cannot be empty.');
      }
      data.phoneNumber = normalisedPhone;
    }

    if (dto.gender !== undefined) {
      data.gender = this.normaliseNullableString(dto.gender);
    }

    if (dto.bio !== undefined) {
      data.bio = this.normaliseNullableString(dto.bio);
    }

    if (dto.addressStreet !== undefined) {
      data.addressStreet = this.normaliseNullableString(dto.addressStreet);
    }

    if (dto.addressHouse !== undefined) {
      data.addressHouse = this.normaliseNullableString(dto.addressHouse);
    }

    if (dto.addressCity !== undefined) {
      data.addressCity = this.normaliseNullableString(dto.addressCity);
    }

    if (dto.addressState !== undefined) {
      data.addressState = this.normaliseNullableString(dto.addressState);
    }

    if (dto.addressCountry !== undefined) {
      data.addressCountry = this.normaliseNullableString(dto.addressCountry);
    }

    if (dto.dateOfBirth !== undefined) {
      const parsed = dto.dateOfBirth ? new Date(dto.dateOfBirth) : null;
      if (parsed && Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('Date of birth is invalid.');
      }
      data.dateOfBirth = parsed;
    }

    if (Object.keys(data).length === 0) {
      return this.toEntity(user);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    const refreshed = await this.fetchUserWithAssociations(userId);
    return this.toEntity(refreshed ?? user);
  }

  async updateProfilePhoto(userId: string, file: UploadedFile): Promise<UserEntity> {
    if (!file || !file.buffer) {
      throw new BadRequestException('No file was provided.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User with the specified id was not found.');
    }

    let storedKey: string | null = null;
    let storedUrl: string | null = null;

    try {
      const stored = await this.storage.saveFile({
        buffer: file.buffer,
        originalName: file.originalname ?? 'profile-photo',
        directory: 'profile-photos',
      });
      storedKey = stored.key;
      storedUrl = stored.url;

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          profilePhotoKey: storedKey,
          profilePhotoUrl: storedUrl,
        },
      });

      if (user.profilePhotoKey && user.profilePhotoKey !== storedKey) {
        await this.storage.deleteFile(user.profilePhotoKey);
      }

      const refreshed = await this.fetchUserWithAssociations(userId);
      return this.toEntity(refreshed ?? user);
    } catch (error) {
      if (storedKey) {
        await this.storage.deleteFile(storedKey);
      }
      throw error;
    }
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User with the specified id was not found.');
    }

    if (dto.role === Role.SUPER_ADMIN && existing.role !== PrismaRole.SUPER_ADMIN) {
      throw new BadRequestException('Cannot promote user to super admin.');
    }

    const data: Prisma.UserUpdateInput = {
      firstName: dto.firstName ?? existing.firstName,
      lastName: dto.lastName ?? existing.lastName,
      phoneNumber: dto.phoneNumber ?? existing.phoneNumber,
      role: dto.role ?? existing.role,
      isActive: dto.isActive ?? existing.isActive,
    };

    const user = await this.prisma.user.update({
      where: { id },
      data,
    });

    return this.toEntity(user);
  }

  async updateStatus(id: string, dto: UpdateUserStatusDto): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User with the specified id was not found.');
    }

    const updateData: Prisma.UserUpdateInput = {
      status: dto.status,
    };

    if (dto.status === UserStatus.REJECTED) {
      if (!dto.rejectionReason?.trim()) {
        throw new BadRequestException('rejectionReason is required when rejecting a user.');
      }
      updateData.rejectionReason = dto.rejectionReason.trim();
      updateData.isActive = false;
    } else {
      updateData.rejectionReason = null;
      updateData.isActive = dto.status === UserStatus.APPROVED ? true : existing.isActive;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    this.logger.log(`User ${id} status changed to ${dto.status}`);

    return this.toEntity(user);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('User with the specified id was not found.');
    }

    await this.prisma.user.delete({ where: { id } });
  }

  private async findByRole(
    role: Role,
    query: RoleQueryDto,
    currentUser?: CurrentUserContext,
  ): Promise<UsersPaginatedResponse> {
    const academyFilter =
      'academyId' in query && query.academyId
        ? {
            academyMemberships: {
              some: {
                academyId: query.academyId,
                status: AcademyMembershipStatus.APPROVED,
              },
            },
          }
        : {};

    const baseWhere: Prisma.UserWhereInput = {
      role,
      ...(query.status ? { status: query.status } : {}),
      ...academyFilter,
    };

    const search = query.search?.trim();
    if (search) {
      baseWhere.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const { where, emptyResult } = await this.buildScopedWhere(baseWhere, currentUser);
    if (emptyResult) {
      return this.emptyPaginatedResponse(query.page);
    }

    const skip = (query.page - 1) * query.limit;
    const include =
      role === Role.TEACHER
        ? { _count: { select: { teachingClasses: true } } }
        : role === Role.STUDENT
        ? { _count: { select: { classParticipants: true } } }
        : undefined;

    const [total, users, statusGroups, inactiveCount] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
        ...(include ? { include } : {}),
      }),
      this.prisma.user.groupBy({
        by: ['status'],
        where,
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
      this.prisma.user.count({
        where: {
          AND: [where, { isActive: false }],
        },
      }),
    ]);

    const data = users.map((user) => this.toEntity(user));
    const totalPages = total === 0 ? 0 : Math.ceil(total / query.limit);

    const statusCountMap = this.extractStatusCounts(statusGroups);

    return {
      data,
      meta: {
        total,
        count: data.length,
        nextPage: query.page < totalPages ? query.page + 1 : null,
        previousPage: query.page > 1 ? query.page - 1 : null,
        currentPage: query.page,
        totalPages,
      },
      summary: this.buildSummary(statusCountMap, inactiveCount),
    };
  }

  private async buildScopedWhere(
    baseWhere: Prisma.UserWhereInput,
    currentUser?: CurrentUserContext,
  ): Promise<{ where: Prisma.UserWhereInput; emptyResult: boolean }> {
    if (!currentUser || currentUser.role === Role.SUPER_ADMIN) {
      return { where: baseWhere, emptyResult: false };
    }

    const scope = await this.academiesService.getAccessibleAcademyScope(
      currentUser.id,
      currentUser.role as unknown as PrismaRole,
    );

    if (scope.unlimited) {
      return { where: baseWhere, emptyResult: false };
    }

    if (scope.academyIds.length === 0) {
      return {
        where: { AND: [baseWhere, { id: { in: [] } }] },
        emptyResult: true,
      };
    }

    const scopedCondition: Prisma.UserWhereInput = {
      OR: [
        {
          academyMemberships: {
            some: {
              academyId: { in: scope.academyIds },
              status: AcademyMembershipStatus.APPROVED,
            },
          },
        },
        {
          ownedAcademy: {
            id: { in: scope.academyIds },
          },
        },
        { id: currentUser.id },
      ],
    };

    return {
      where: {
        AND: [baseWhere, scopedCondition],
      },
      emptyResult: false,
    };
  }

  private emptyPaginatedResponse(page: number): UsersPaginatedResponse {
    const zeroCounts: Record<PrismaUserStatus, number> = {
      [PrismaUserStatus.APPROVED]: 0,
      [PrismaUserStatus.PENDING]: 0,
      [PrismaUserStatus.REJECTED]: 0,
    };

    return {
      data: [],
      meta: {
        total: 0,
        count: 0,
        currentPage: page,
        totalPages: 0,
        nextPage: null,
        previousPage: page > 1 ? page - 1 : null,
      },
      summary: this.buildSummary(zeroCounts, 0),
    };
  }

  private extractStatusCounts(
    groups: Array<{ status: PrismaUserStatus; _count: true | { _all?: number } | null | undefined }>,
  ): Record<PrismaUserStatus, number> {
    return groups.reduce<Record<PrismaUserStatus, number>>(
      (acc, group) => {
        const countValue =
          typeof group._count === 'object' && group._count !== null && '_all' in group._count
            ? ((group._count as { _all?: number })._all ?? 0)
            : 0;
        acc[group.status] = countValue;
        return acc;
      },
      {
        [PrismaUserStatus.APPROVED]: 0,
        [PrismaUserStatus.PENDING]: 0,
        [PrismaUserStatus.REJECTED]: 0,
      },
    );
  }

  private buildSummary(statusCounts: Record<PrismaUserStatus, number>, inactiveCount: number): UsersSummary {
    return {
      approved: statusCounts[PrismaUserStatus.APPROVED] ?? 0,
      pending: statusCounts[PrismaUserStatus.PENDING] ?? 0,
      rejected: statusCounts[PrismaUserStatus.REJECTED] ?? 0,
      inactive: inactiveCount,
    };
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
  }

  private toEntity(user: User): UserEntity {
    const { password, ...rest } = user;
    return new UserEntity(rest);
  }

  private async fetchUserWithAssociations(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        academyMemberships: {
          select: {
            academyId: true,
            status: true,
          },
        },
        ownedAcademy: {
          select: { id: true },
        },
      },
    });
  }

  private normaliseNullableString(value?: string | null): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
}





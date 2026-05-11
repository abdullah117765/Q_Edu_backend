import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AcademyMembershipStatus,
  Prisma,
  Role as PrismaRole,
  UserStatus as PrismaUserStatus,
  User,
  ZoomCreditAuditAction,
  ZoomCreditTransactionType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UploadedFile } from '../../common/interfaces/uploaded-file.interface';

import { PaginatedResponse } from '../../common/interfaces/pagination.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { AcademiesService } from '../academies/academies.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AdminsQueryDto } from './dto/admins-query.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { CreateStudentDto } from './dto/create-student.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { StudentsQueryDto } from './dto/students-query.dto';
import { TeachersQueryDto } from './dto/teachers-query.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersDirectoryQueryDto } from './dto/users-directory-query.dto';
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

type UsersPaginatedResponse = PaginatedResponse<UserEntity> & {
  summary: UsersSummary;
};

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
    private readonly notifications: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email address is already in use.');
    }

    const role = dto.role ?? Role.STUDENT;
    if (role === Role.SUPER_ADMIN) {
      const superAdminCount = await this.prisma.user.count({
        where: { role: PrismaRole.SUPER_ADMIN },
      });
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
        await this.grantInitialAcademyOwnerCredits(user.id);
      } catch (error) {
        this.logger.error(
          `Failed to provision academy for owner ${user.id}: ${(error as Error).message}`,
        );
        await this.prisma.user.delete({ where: { id: user.id } });
        throw error;
      }
    }

    return this.toEntity(user);
  }

  async createAdmin(dto: CreateAdminDto): Promise<UserEntity> {
    return this.create({ ...(dto as CreateUserDto), role: Role.ACADEMY_OWNER });
  }

  async createTeacher(
    dto: CreateTeacherDto,
    currentUser?: CurrentUserContext,
  ): Promise<UserEntity> {
    const created = await this.create({
      ...(dto as CreateUserDto),
      role: Role.TEACHER,
    });
    await this.linkToOwnerAcademy(created.id, 'TEACHER', currentUser);
    return created;
  }

  async createStudent(
    dto: CreateStudentDto,
    currentUser?: CurrentUserContext,
  ): Promise<UserEntity> {
    const created = await this.create({
      ...(dto as CreateUserDto),
      role: Role.STUDENT,
    });
    await this.linkToOwnerAcademy(created.id, 'STUDENT', currentUser);
    return created;
  }

  private async linkToOwnerAcademy(
    userId: string,
    role: 'TEACHER' | 'STUDENT',
    currentUser?: CurrentUserContext,
  ): Promise<void> {
    if (!currentUser || currentUser.role !== Role.ACADEMY_OWNER) return;
    const academy = await this.prisma.academy.findUnique({
      where: { ownerId: currentUser.id },
      select: { id: true },
    });
    if (!academy) return;
    await this.prisma.academyMembership.upsert({
      where: { academyId_userId: { academyId: academy.id, userId } },
      create: {
        academyId: academy.id,
        userId,
        role: role as any,
        status: AcademyMembershipStatus.PENDING,
        actionedById: currentUser.id,
      },
      update: {},
    });
  }

  private async grantInitialAcademyOwnerCredits(userId: string): Promise<void> {
    const initialCredits =
      this.configService.get<number>(
        'billing.academyOwnerInitialFreeCredits',
      ) ?? 100;

    if (initialCredits <= 0) {
      return;
    }

    const existingGrant = await this.prisma.zoomCreditTransaction.findFirst({
      where: {
        userId,
        type: ZoomCreditTransactionType.CREDIT,
        reason: 'Initial academy owner credit grant',
      },
      select: { id: true },
    });

    if (existingGrant) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const balance = await tx.zoomCreditBalance.upsert({
        where: { userId },
        create: { userId, balance: initialCredits },
        update: { balance: { increment: initialCredits } },
      });

      const transaction = await tx.zoomCreditTransaction.create({
        data: {
          userId,
          type: ZoomCreditTransactionType.CREDIT,
          amount: initialCredits,
          runningBalance: balance.balance,
          reason: 'Initial academy owner credit grant',
          metadata: {
            source: 'academy_owner.initial_grant',
            initialCredits,
          },
        },
      });

      await tx.zoomCreditAuditLog.create({
        data: {
          transactionId: transaction.id,
          action: ZoomCreditAuditAction.CREATED,
          details: {
            source: 'academy_owner.initial_grant',
            initialCredits,
          },
        },
      });
    });
  }

  async findAll(
    query: UsersDirectoryQueryDto,
    currentUser?: CurrentUserContext,
  ): Promise<UsersPaginatedResponse> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    let ownerAcademyIds: string[] = [];
    if (query.ownerId) {
      const ownerAcademies = await this.prisma.academy.findMany({
        where: { ownerId: query.ownerId },
        select: { id: true },
      });
      ownerAcademyIds = ownerAcademies.map((academy) => academy.id);
    }

    const roleFilter: Prisma.UserWhereInput = query.role
      ? { role: query.role }
      : {};

    const academyFilter: Prisma.UserWhereInput = query.academyId
      ? {
          OR: [
            { ownedAcademy: { id: query.academyId } },
            {
              academyMemberships: {
                some: {
                  academyId: query.academyId,
                },
              },
            },
          ],
        }
      : {};

    const ownerFilter: Prisma.UserWhereInput = query.ownerId
      ? ownerAcademyIds.length > 0
        ? {
            OR: [
              { ownedAcademy: { ownerId: query.ownerId } },
              {
                academyMemberships: {
                  some: {
                    academyId: { in: ownerAcademyIds },
                  },
                },
              },
            ],
          }
        : { id: { in: [] } }
      : {};

    const baseWhere: Prisma.UserWhereInput = {
      role: { not: PrismaRole.SUPER_ADMIN },
      ...(query.status ? { status: query.status } : {}),
      ...roleFilter,
      ...(query.academyId ? { AND: [academyFilter] } : {}),
      ...(query.ownerId ? { AND: [ownerFilter] } : {}),
    };

    if (query.academyId && query.ownerId) {
      baseWhere.AND = [academyFilter, ownerFilter];
    }

    const search = query.search?.trim();
    if (search) {
      baseWhere.OR = [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const { where, emptyResult } = await this.buildScopedWhere(
      baseWhere,
      currentUser,
    );
    if (emptyResult) {
      return this.emptyPaginatedResponse(page);
    }

    const [total, users, statusGroups, inactiveCount] =
      await this.prisma.$transaction([
        this.prisma.user.count({ where }),
        this.prisma.user.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: {
            _count: {
              select: {
                teachingClasses: true,
                classParticipants: true,
                resources: true,
              },
            },
            ownedAcademy: { select: { id: true, name: true, status: true } },
            academyMemberships: {
              select: {
                academyId: true,
                status: true,
                academy: {
                  select: {
                    id: true,
                    name: true,
                    ownerId: true,
                    owner: {
                      select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                      },
                    },
                  },
                },
              },
            },
          },
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

    const data = users.map((userRecord) => {
      const { academyMemberships, ownedAcademy, ...rest } =
        userRecord as typeof userRecord & {
          academyMemberships?: Array<{
            academyId: string;
            status: AcademyMembershipStatus;
            academy?: {
              id: string;
              name: string | null;
              ownerId?: string | null;
              owner?: {
                firstName: string | null;
                lastName: string | null;
                email: string | null;
              } | null;
            };
          }>;
          ownedAcademy?: {
            id: string;
            name: string | null;
            status?: string;
          } | null;
        };
      const entity = this.toEntity(rest as unknown as User);
      if (Array.isArray(academyMemberships)) {
        entity.academies = academyMemberships.map((membership) => ({
          academyId: membership.academyId,
          academyName: membership.academy?.name ?? null,
          academyOwnerId: membership.academy?.ownerId ?? null,
          academyOwnerName: this.buildDisplayName(membership.academy?.owner),
          status: membership.status,
        }));
      }
      if (ownedAcademy) {
        entity.academy = {
          id: ownedAcademy.id,
          name: ownedAcademy.name ?? null,
          status: (ownedAcademy.status as string | undefined) ?? null,
        };
      }
      return entity;
    });
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

  async findOne(
    id: string,
    currentUser?: CurrentUserContext,
  ): Promise<UserEntity> {
    const user = await this.fetchUserWithAssociations(id);
    if (!user) {
      throw new NotFoundException('User with the specified id was not found.');
    }

    if (
      currentUser &&
      currentUser.id !== id &&
      currentUser.role !== Role.SUPER_ADMIN
    ) {
      const scope = await this.academiesService.getAccessibleAcademyScope(
        currentUser.id,
        currentUser.role as unknown as PrismaRole,
      );

      if (!scope.unlimited) {
        const approvedMembershipAcademyIds = (user.academyMemberships ?? [])
          .filter(
            (membership) =>
              membership.status === AcademyMembershipStatus.APPROVED,
          )
          .map((membership) => membership.academyId);
        const ownedAcademyIds = user.ownedAcademy ? [user.ownedAcademy.id] : [];
        const accessibleAcademyIds = new Set([
          ...approvedMembershipAcademyIds,
          ...ownedAcademyIds,
        ]);
        const hasOverlap = scope.academyIds.some((academyId) =>
          accessibleAcademyIds.has(academyId),
        );

        if (!hasOverlap) {
          throw new ForbiddenException(
            'You are not authorized to view this user.',
          );
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

  async updateOwnProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserEntity> {
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

  async updateProfilePhoto(
    userId: string,
    file: UploadedFile,
  ): Promise<UserEntity> {
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

    if (
      dto.role === Role.SUPER_ADMIN &&
      existing.role !== PrismaRole.SUPER_ADMIN
    ) {
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

  async updateStatus(
    id: string,
    dto: UpdateUserStatusDto,
    currentUser?: CurrentUserContext,
  ): Promise<UserEntity> {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: {
        academyMemberships: { select: { academyId: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException('User with the specified id was not found.');
    }

    if (currentUser && currentUser.role === Role.ACADEMY_OWNER) {
      if (existing.role !== Role.TEACHER && existing.role !== Role.STUDENT) {
        throw new ForbiddenException(
          'Academy owners can only manage teachers or students in their academy.',
        );
      }
      const academy = await this.prisma.academy.findUnique({
        where: { ownerId: currentUser.id },
        select: { id: true },
      });
      if (!academy) {
        throw new ForbiddenException(
          'Owner academy not found for membership scope check.',
        );
      }
      const inAcademy = existing.academyMemberships.some(
        (m) => m.academyId === academy.id,
      );
      if (!inAcademy) {
        throw new ForbiddenException('User does not belong to your academy.');
      }
    }

    const updateData: Prisma.UserUpdateInput = {
      status: dto.status,
    };

    if (dto.status === UserStatus.REJECTED) {
      if (!dto.rejectionReason?.trim()) {
        throw new BadRequestException(
          'rejectionReason is required when rejecting a user.',
        );
      }
      updateData.rejectionReason = dto.rejectionReason.trim();
      updateData.isActive = false;
    } else {
      updateData.rejectionReason = null;
      updateData.isActive =
        dto.status === UserStatus.APPROVED ? true : existing.isActive;
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    if (existing.role === Role.TEACHER || existing.role === Role.STUDENT) {
      const membershipStatus =
        dto.status === UserStatus.APPROVED
          ? AcademyMembershipStatus.APPROVED
          : dto.status === UserStatus.REJECTED
            ? AcademyMembershipStatus.REJECTED
            : AcademyMembershipStatus.PENDING;
      await this.prisma.academyMembership.updateMany({
        where: { userId: id },
        data: {
          status: membershipStatus,
          respondedAt: new Date(),
          actionedById: currentUser?.id,
        },
      });

      const notifyType =
        dto.status === UserStatus.APPROVED
          ? 'MEMBERSHIP_APPROVED'
          : dto.status === UserStatus.REJECTED
            ? 'MEMBERSHIP_REJECTED'
            : 'MEMBERSHIP_PENDING';
      const notifyTitle =
        dto.status === UserStatus.APPROVED
          ? 'You have been approved'
          : dto.status === UserStatus.REJECTED
            ? 'Your access was rejected'
            : 'Your application is pending review';
      const notifyBody =
        dto.status === UserStatus.REJECTED && updateData.rejectionReason
          ? `Reason: ${updateData.rejectionReason}`
          : dto.status === UserStatus.APPROVED
            ? 'You can now sign in and access your academy.'
            : 'We are reviewing your application.';
      try {
        await this.notifications.notify({
          userId: id,
          type: notifyType as any,
          title: notifyTitle,
          body: notifyBody,
          data: { previousStatus: existing.status, newStatus: dto.status },
        });
      } catch (err) {
        this.logger.warn(
          `Status notification dispatch failed: ${(err as Error).message}`,
        );
      }
    }

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

    const { where, emptyResult } = await this.buildScopedWhere(
      baseWhere,
      currentUser,
    );
    if (emptyResult) {
      return this.emptyPaginatedResponse(query.page);
    }

    const skip = (query.page - 1) * query.limit;
    const membershipWhere =
      currentUser?.role === Role.SUPER_ADMIN
        ? undefined
        : { status: AcademyMembershipStatus.APPROVED };
    const membershipInclude = {
      ...(membershipWhere ? { where: membershipWhere } : {}),
      select: {
        academyId: true,
        status: true,
        academy: {
          select: {
            id: true,
            name: true,
            ownerId: true,
            owner: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    };
    const include =
      role === Role.TEACHER
        ? {
            _count: { select: { teachingClasses: true, resources: true } },
            academyMemberships: membershipInclude,
          }
        : role === Role.STUDENT
          ? {
              _count: { select: { classParticipants: true } },
              academyMemberships: membershipInclude,
            }
          : role === Role.ACADEMY_OWNER
            ? {
                ownedAcademy: {
                  select: { id: true, name: true, status: true },
                },
              }
            : undefined;

    const [total, users, statusGroups, inactiveCount] =
      await this.prisma.$transaction([
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

    const data = users.map((userRecord) => {
      const { academyMemberships, ownedAcademy, ...rest } =
        userRecord as typeof userRecord & {
          academyMemberships?: Array<{
            academyId: string;
            status: AcademyMembershipStatus;
            academy?: {
              id: string;
              name: string | null;
              ownerId?: string | null;
              owner?: {
                firstName: string | null;
                lastName: string | null;
                email: string | null;
              } | null;
            };
          }>;
          ownedAcademy?: {
            id: string;
            name: string | null;
            status?: string;
          } | null;
        };
      const entity = this.toEntity(rest as unknown as User);
      if (Array.isArray(academyMemberships)) {
        entity.academies = academyMemberships.map((membership) => ({
          academyId: membership.academyId,
          academyName: membership.academy?.name ?? null,
          academyOwnerId: membership.academy?.ownerId ?? null,
          academyOwnerName: this.buildDisplayName(membership.academy?.owner),
          status: membership.status,
        }));
      }
      if (ownedAcademy) {
        entity.academy = {
          id: ownedAcademy.id,
          name: ownedAcademy.name ?? null,
          status: (ownedAcademy.status as string | undefined) ?? null,
        };
      }
      return entity;
    });
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
    groups: Array<{
      status: PrismaUserStatus;
      _count: true | { _all?: number } | null | undefined;
    }>,
  ): Record<PrismaUserStatus, number> {
    return groups.reduce<Record<PrismaUserStatus, number>>(
      (acc, group) => {
        const countValue =
          typeof group._count === 'object' &&
          group._count !== null &&
          '_all' in group._count
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

  private buildSummary(
    statusCounts: Record<PrismaUserStatus, number>,
    inactiveCount: number,
  ): UsersSummary {
    return {
      approved: statusCounts[PrismaUserStatus.APPROVED] ?? 0,
      pending: statusCounts[PrismaUserStatus.PENDING] ?? 0,
      rejected: statusCounts[PrismaUserStatus.REJECTED] ?? 0,
      inactive: inactiveCount,
    };
  }

  private buildDisplayName(
    user?: {
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
    } | null,
  ): string | null {
    if (!user) {
      return null;
    }

    const fullName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();
    return fullName || user.email || null;
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

  private normaliseNullableString(
    value?: string | null,
  ): string | null | undefined {
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

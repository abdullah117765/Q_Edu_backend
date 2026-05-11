import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Academy,
  AcademyMemberRole,
  AcademyMembership,
  AcademyMembershipStatus,
  AcademyStatus,
  Prisma,
  Role as PrismaRole,
  UserStatus as PrismaUserStatus,
} from '@prisma/client';
import { PaginatedResponse } from '../../common/interfaces/pagination.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { AcademyDirectoryQueryDto } from './dto/academy-directory-query.dto';
import { AcademyMembershipQueryDto } from './dto/academy-membership-query.dto';
import { UpdateAcademyMembershipStatusDto } from './dto/update-academy-membership-status.dto';
import { AdminAcademyQueryDto } from './dto/admin-academy-query.dto';
import { SubmitOwnerOnboardingDto } from './dto/submit-owner-onboarding.dto';
import { UpdateAcademyReviewDto } from './dto/update-academy-review.dto';
import {
  AcademyDetailEntity,
  AcademyMembershipEntity,
  AcademySummaryEntity,
} from './entities/academy.entity';
import { AcademyMembershipAction } from './dto/update-academy-membership-status.dto';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class AcademiesService {
  private readonly logger = new Logger(AcademiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  async ensureAcademyForOwner(params: {
    ownerId: string;
    name?: string | null;
    description?: string | null;
  }): Promise<AcademyDetailEntity> {
    const existing = await this.prisma.academy.findUnique({
      where: { ownerId: params.ownerId },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });
    if (existing) {
      return this.buildAcademyDetail(existing);
    }

    const trimmedName = params.name?.trim() || (await this.buildDefaultAcademyName(params.ownerId));
    if (!trimmedName) {
      throw new BadRequestException('Academy name cannot be empty.');
    }

    const normalisedDescription = params.description?.trim() || null;

    const created = await this.prisma.$transaction(async (tx) => {
      const slug = await this.generateUniqueSlug(trimmedName, tx);
      return tx.academy.create({
        data: {
          ownerId: params.ownerId,
          name: trimmedName,
          slug,
          description: normalisedDescription,
          status: AcademyStatus.PENDING,
          profileCompleted: Boolean(params.name?.trim()),
        },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
      });
    });

    this.logger.log(`Academy ${created.id} provisioned for owner ${params.ownerId}`);
    return this.buildAcademyDetail(created);
  }

  async submitOwnerOnboarding(ownerId: string, dto: SubmitOwnerOnboardingDto): Promise<AcademyDetailEntity> {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true, role: true },
    });
    if (!owner || owner.role !== PrismaRole.ACADEMY_OWNER) {
      throw new ForbiddenException('Only academy owners can submit onboarding details.');
    }

    const trimmedName = dto.name.trim();
    if (!trimmedName) {
      throw new BadRequestException('Academy name cannot be empty.');
    }

    const normalisedDescription = dto.description?.trim() || null;
    const existing = await this.prisma.academy.findUnique({ where: { ownerId } });

    let record: Academy;
    if (!existing) {
      return this.ensureAcademyForOwner({
        ownerId,
        name: trimmedName,
        description: normalisedDescription,
      });
    } else {
      const shouldResetReview = existing.status !== AcademyStatus.APPROVED;
      record = await this.prisma.academy.update({
        where: { id: existing.id },
        data: {
          name: trimmedName,
          description: normalisedDescription,
          profileCompleted: true,
          ...(shouldResetReview
            ? {
                status: AcademyStatus.PENDING,
                rejectionReason: null,
                reviewedAt: null,
                reviewedById: null,
              }
            : {}),
        },
      });
      this.logger.log(`Academy ${record.id} updated by owner ${ownerId}`);
    }

    return this.buildAcademyDetail(record);
  }

  async getAcademyForOwner(ownerId: string): Promise<AcademyDetailEntity> {
    const academy = await this.prisma.academy.findUnique({
      where: { ownerId },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });
    if (!academy) {
      return this.ensureAcademyForOwner({ ownerId });
    }

    return this.buildAcademyDetail(academy);
  }

  async listDirectory(query: AcademyDirectoryQueryDto): Promise<PaginatedResponse<AcademySummaryEntity>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AcademyWhereInput = {
      status: AcademyStatus.APPROVED,
    };
    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search.toLowerCase() } },
        { description: { contains: search } },
      ];
    }

    const [total, academies] = await this.prisma.$transaction([
      this.prisma.academy.count({ where }),
      this.prisma.academy.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const data = academies.map((academy) => this.toSummaryEntity(academy));
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        count: data.length,
        currentPage: page,
        totalPages,
        nextPage: page < totalPages ? page + 1 : null,
        previousPage: page > 1 ? page - 1 : null,
      },
    };
  }

  async listForAdmin(
    query: AdminAcademyQueryDto,
  ): Promise<PaginatedResponse<AcademySummaryEntity> & { summary: Record<'approved' | 'pending' | 'rejected', number> }> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AcademyWhereInput = {};
    if (query.status) {
      where.status = query.status;
    }

    const search = query.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search.toLowerCase() } },
        { description: { contains: search } },
        { owner: { email: { contains: search } } },
      ];
    }

    const [total, academies, statusGroups] = await this.prisma.$transaction([
      this.prisma.academy.count({ where }),
      this.prisma.academy.findMany({
        where,
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.academy.groupBy({
        by: ['status'],
        _count: { _all: true },
        orderBy: { status: 'asc' },
      }),
    ]);

    const data = academies.map((academy) => this.toSummaryEntity(academy));
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        count: data.length,
        currentPage: page,
        totalPages,
        nextPage: page < totalPages ? page + 1 : null,
        previousPage: page > 1 ? page - 1 : null,
      },
      summary: this.buildAcademyStatusSummary(statusGroups),
    };
  }

  async getAcademyForAdmin(academyId: string): Promise<AcademyDetailEntity> {
    const academy = await this.prisma.academy.findUnique({
      where: { id: academyId },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!academy) {
      throw new NotFoundException('Academy not found.');
    }

    return this.buildAcademyDetail(academy);
  }

  async reviewAcademy(
    academyId: string,
    reviewerId: string,
    dto: UpdateAcademyReviewDto,
  ): Promise<AcademyDetailEntity> {
    if (dto.status === AcademyStatus.PENDING) {
      throw new BadRequestException('Use owner onboarding to resubmit academy details.');
    }

    const academy = await this.prisma.academy.findUnique({
      where: { id: academyId },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!academy) {
      throw new NotFoundException('Academy not found.');
    }

    const rejectionReason =
      dto.status === AcademyStatus.REJECTED ? dto.reason?.trim() ?? null : null;

    const updated = await this.prisma.academy.update({
      where: { id: academyId },
      data: {
        status: dto.status,
        rejectionReason,
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    this.logger.log(`Academy ${academyId} set to ${dto.status} by ${reviewerId}`);
    return this.buildAcademyDetail(updated);
  }

  async requestMembership(userId: string, academyId: string): Promise<AcademyMembershipEntity> {
    const [user, academy] = await this.prisma.$transaction([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, status: true },
      }),
      this.prisma.academy.findUnique({ where: { id: academyId } }),
    ]);

    if (!user) {
      throw new NotFoundException('User account not found.');
    }

    if (!academy) {
      throw new NotFoundException('Academy not found.');
    }
    if (academy.status !== AcademyStatus.APPROVED) {
      throw new BadRequestException('This academy is not accepting new members yet.');
    }

    if (user.status !== PrismaUserStatus.APPROVED) {
      throw new ForbiddenException('Your account must be approved before requesting academy access.');
    }

    if (user.role === PrismaRole.SUPER_ADMIN || user.role === PrismaRole.ACADEMY_OWNER) {
      throw new ForbiddenException('Only teachers and students can request academy membership.');
    }

    const intendedRole =
      user.role === PrismaRole.TEACHER
        ? AcademyMemberRole.TEACHER
        : AcademyMemberRole.STUDENT;

    await this.enforceMembershipLimit(user.id, user.role);

    const membership = await this.prisma.academyMembership.findUnique({
      where: {
        academyId_userId: { academyId, userId },
      },
      include: {
        user: true,
      },
    });

    if (!membership) {
      const created = await this.prisma.academyMembership.create({
        data: {
          academyId,
          userId,
          role: intendedRole,
          status: AcademyMembershipStatus.PENDING,
        },
        include: { user: true, academy: true },
      });
      this.logger.log(`Membership request created: academy=${academyId} user=${userId}`);
      return this.toMembershipEntity(created);
    }

    if (membership.status === AcademyMembershipStatus.APPROVED) {
      throw new ConflictException('You are already a member of this academy.');
    }

    if (membership.status === AcademyMembershipStatus.PENDING) {
      throw new ConflictException('You already have a pending request with this academy.');
    }

    const updated = await this.prisma.academyMembership.update({
      where: { id: membership.id },
      data: {
        status: AcademyMembershipStatus.PENDING,
        reason: null,
        respondedAt: null,
        actionedById: null,
        role: intendedRole,
        requestedAt: new Date(),
      },
      include: { user: true, academy: true },
    });

    this.logger.log(`Membership request re-opened: academy=${academyId} user=${userId}`);
    return this.toMembershipEntity(updated);
  }

  async withdrawMembership(userId: string, membershipId: string): Promise<AcademyMembershipEntity> {
    const membership = await this.prisma.academyMembership.findUnique({
      where: { id: membershipId },
      include: {
        user: true,
        academy: true,
      },
    });

    if (!membership || membership.userId !== userId) {
      throw new NotFoundException('Membership record not found.');
    }

    if (membership.status === AcademyMembershipStatus.APPROVED) {
      const updated = await this.prisma.academyMembership.update({
        where: { id: membershipId },
        data: {
          status: AcademyMembershipStatus.REVOKED,
          reason: 'Cancelled by member',
          respondedAt: new Date(),
          actionedById: null,
        },
        include: { user: true, academy: true },
      });
      this.logger.log(`Membership ${membershipId} revoked by member ${userId}`);
      return this.toMembershipEntity(updated);
    }

    if (membership.status !== AcademyMembershipStatus.PENDING) {
      throw new BadRequestException('Only pending or approved memberships can be withdrawn.');
    }

    await this.prisma.academyMembership.delete({ where: { id: membershipId } });
    this.logger.log(`Membership request ${membershipId} withdrawn by member ${userId}`);
    return this.toMembershipEntity(membership);
  }

  async listMembershipsForOwner(
    ownerId: string,
    query: AcademyMembershipQueryDto,
  ): Promise<PaginatedResponse<AcademyMembershipEntity>> {
    const academy = await this.requireOwnerAcademy(ownerId, { requireApproved: true });

    const where: Prisma.AcademyMembershipWhereInput = {
      academyId: academy.id,
      ...(query.status ? { status: query.status } : {}),
    };

    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [total, memberships] = await this.prisma.$transaction([
      this.prisma.academyMembership.count({ where }),
      this.prisma.academyMembership.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phoneNumber: true,
              gender: true,
              bio: true,
              dateOfBirth: true,
              addressStreet: true,
              addressHouse: true,
              addressCity: true,
              addressState: true,
              addressCountry: true,
              profilePhotoUrl: true,
              role: true,
              status: true,
              _count: {
                select: {
                  teachingClasses: true,
                  classParticipants: true,
                  resources: true,
                },
              },
            },
          },
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data = memberships.map((record) => this.toMembershipEntity(record));
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        count: data.length,
        currentPage: page,
        totalPages,
        nextPage: page < totalPages ? page + 1 : null,
        previousPage: page > 1 ? page - 1 : null,
      },
    };
  }

  async listMembershipsForUser(
    userId: string,
    query: AcademyMembershipQueryDto,
  ): Promise<PaginatedResponse<AcademyMembershipEntity>> {
    const where: Prisma.AcademyMembershipWhereInput = {
      userId,
      ...(query.status ? { status: query.status } : {}),
    };

    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const [total, memberships] = await this.prisma.$transaction([
      this.prisma.academyMembership.count({ where }),
      this.prisma.academyMembership.findMany({
        where,
        include: {
          academy: true,
        },
        orderBy: { requestedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const data = memberships.map((record) => this.toMembershipEntity(record));
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        count: data.length,
        currentPage: page,
        totalPages,
        nextPage: page < totalPages ? page + 1 : null,
        previousPage: page > 1 ? page - 1 : null,
      },
    };
  }

  async updateMembershipStatus(
    ownerId: string,
    membershipId: string,
    dto: UpdateAcademyMembershipStatusDto,
  ): Promise<AcademyMembershipEntity> {
    const membership = await this.prisma.academyMembership.findUnique({
      where: { id: membershipId },
      include: {
        academy: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership record not found.');
    }

    if (membership.academy.ownerId !== ownerId) {
      throw new ForbiddenException('You can only manage memberships for your own academy.');
    }
    if (membership.academy.status !== AcademyStatus.APPROVED) {
      throw new ForbiddenException('Only approved academies can manage memberships.');
    }

    switch (dto.action) {
      case AcademyMembershipAction.APPROVE:
        if (membership.status !== AcademyMembershipStatus.PENDING) {
          throw new BadRequestException('Only pending requests can be approved.');
        }
        break;
      case AcademyMembershipAction.REJECT:
        if (membership.status !== AcademyMembershipStatus.PENDING) {
          throw new BadRequestException('Only pending requests can be rejected.');
        }
        if (!dto.reason || dto.reason.trim().length < 3) {
          throw new BadRequestException('A reason of at least 3 characters is required when rejecting a request.');
        }
        break;
      case AcademyMembershipAction.REVOKE:
        if (membership.status !== AcademyMembershipStatus.APPROVED) {
          throw new BadRequestException('Only approved memberships can be revoked.');
        }
        if (!dto.reason || dto.reason.trim().length < 3) {
          throw new BadRequestException('A reason of at least 3 characters is required when revoking access.');
        }
        break;
      default:
        throw new BadRequestException(`Unsupported action "${dto.action}".`);
    }

    const now = new Date();
    let status: AcademyMembershipStatus = membership.status;
    let reason: string | null = null;

    if (dto.action === AcademyMembershipAction.APPROVE) {
      status = AcademyMembershipStatus.APPROVED;
      reason = null;
    }

    if (dto.action === AcademyMembershipAction.REJECT) {
      status = AcademyMembershipStatus.REJECTED;
      reason = dto.reason?.trim() ?? null;
    }

    if (dto.action === AcademyMembershipAction.REVOKE) {
      status = AcademyMembershipStatus.REVOKED;
      reason = dto.reason?.trim() ?? null;
    }

    const updated = await this.prisma.academyMembership.update({
      where: { id: membership.id },
      data: {
        status,
        reason,
        respondedAt: now,
        actionedById: ownerId,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            status: true,
          },
        },
      },
    });

    this.logger.log(
      `Membership status updated: membership=${membership.id} status=${status} action=${dto.action} owner=${ownerId}`,
    );
    return this.toMembershipEntity(updated);
  }

  async getAccessibleAcademyScope(
    userId: string,
    role: PrismaRole,
  ): Promise<{ unlimited: boolean; academyIds: string[] }> {
    if (!userId) {
      return { unlimited: false, academyIds: [] };
    }

    if (role === PrismaRole.SUPER_ADMIN) {
      return { unlimited: true, academyIds: [] };
    }

    if (role === PrismaRole.ACADEMY_OWNER) {
      const academy = await this.prisma.academy.findFirst({
        where: { ownerId: userId, status: AcademyStatus.APPROVED },
        select: { id: true },
      });
      return {
        unlimited: false,
        academyIds: academy ? [academy.id] : [],
      };
    }

    const memberships = await this.prisma.academyMembership.findMany({
      where: {
        userId,
        status: AcademyMembershipStatus.APPROVED,
      },
      select: { academyId: true },
    });

    return {
      unlimited: false,
      academyIds: memberships.map((membership) => membership.academyId),
    };
  }

  private async buildAcademyDetail(
    record: Academy & {
      owner?: {
        id: string;
        firstName: string;
        lastName: string | null;
        email: string;
        phoneNumber: string | null;
      } | null;
    },
  ): Promise<AcademyDetailEntity> {
    const [teacherCount, studentCount, pendingCount] = await this.prisma.$transaction([
      this.prisma.academyMembership.count({
        where: {
          academyId: record.id,
          status: AcademyMembershipStatus.APPROVED,
          role: AcademyMemberRole.TEACHER,
        },
      }),
      this.prisma.academyMembership.count({
        where: {
          academyId: record.id,
          status: AcademyMembershipStatus.APPROVED,
          role: AcademyMemberRole.STUDENT,
        },
      }),
      this.prisma.academyMembership.count({
        where: { academyId: record.id, status: AcademyMembershipStatus.PENDING },
      }),
    ]);

    const summary = this.toSummaryEntity(record);

    return new AcademyDetailEntity({
      ...summary,
      teacherCount,
      studentCount,
      pendingCount,
    });
  }

  private toSummaryEntity(
    record: Academy & {
      owner?: {
        id: string;
        firstName: string;
        lastName: string | null;
        email: string;
        phoneNumber: string | null;
      } | null;
    },
    ): AcademySummaryEntity {
      const summary = new AcademySummaryEntity({
        id: record.id,
        name: record.name,
        slug: record.slug,
        description: record.description,
        ownerId: record.ownerId,
        profileCompleted: Boolean(record.profileCompleted),
        status: record.status,
      rejectionReason: record.rejectionReason,
      reviewedById: record.reviewedById,
      reviewedAt: record.reviewedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });

    if (record.owner) {
      summary.owner = {
        id: record.owner.id,
        firstName: record.owner.firstName,
        lastName: record.owner.lastName,
        email: record.owner.email,
        phoneNumber: record.owner.phoneNumber,
      };
    }

    return summary;
  }

  private buildAcademyStatusSummary(
    groups: Array<{
      status: AcademyStatus;
      _count?: { _all?: number } | number | true | null;
    }>,
  ): Record<'approved' | 'pending' | 'rejected', number> {
    const summary: Record<'approved' | 'pending' | 'rejected', number> = {
      approved: 0,
      pending: 0,
      rejected: 0,
    };

    groups.forEach((group) => {
      const value =
        typeof group._count === 'number'
          ? group._count
          : group._count && typeof group._count === 'object' && typeof group._count._all === 'number'
          ? group._count._all
          : 0;
      if (group.status === AcademyStatus.APPROVED) {
        summary.approved = value;
      } else if (group.status === AcademyStatus.PENDING) {
        summary.pending = value;
      } else if (group.status === AcademyStatus.REJECTED) {
        summary.rejected = value;
      }
    });

    return summary;
  }

  private toMembershipEntity(
    record: AcademyMembership & {
      user?: {
        id: string;
        firstName: string;
        lastName: string | null;
        email: string;
        phoneNumber?: string | null;
        gender?: string | null;
        bio?: string | null;
        dateOfBirth?: Date | null;
        addressStreet?: string | null;
        addressHouse?: string | null;
        addressCity?: string | null;
        addressState?: string | null;
        addressCountry?: string | null;
        profilePhotoUrl?: string | null;
        role: PrismaRole;
        status: PrismaUserStatus;
        _count?: Record<string, number> | null;
      } | null;
      academy?: Academy | null;
    },
  ): AcademyMembershipEntity {
    return new AcademyMembershipEntity({
      id: record.id,
      academyId: record.academyId,
      userId: record.userId,
      role: record.role,
      status: record.status,
      requestedAt: record.requestedAt,
      respondedAt: record.respondedAt,
      reason: record.reason,
      actionedById: record.actionedById,
      user: record.user
        ? {
            id: record.user.id,
            firstName: record.user.firstName,
            lastName: record.user.lastName,
            email: record.user.email,
            phoneNumber: record.user.phoneNumber,
            gender: record.user.gender,
            bio: record.user.bio,
            dateOfBirth: record.user.dateOfBirth,
            addressStreet: record.user.addressStreet,
            addressHouse: record.user.addressHouse,
            addressCity: record.user.addressCity,
            addressState: record.user.addressState,
            addressCountry: record.user.addressCountry,
            profilePhotoUrl: record.user.profilePhotoUrl,
            role: record.user.role,
            status: record.user.status,
            _count: record.user._count ?? null,
          }
        : undefined,
      academy: record.academy
        ? this.toSummaryEntity(record.academy)
      : undefined,
    });
  }

  private async requireOwnerAcademy(
    ownerId: string,
    options?: { requireApproved?: boolean },
  ): Promise<Academy> {
    const academy = await this.prisma.academy.findUnique({ where: { ownerId } });
    if (!academy) {
      throw new BadRequestException('Complete your academy onboarding before managing academy resources.');
    }

    if (options?.requireApproved && academy.status !== AcademyStatus.APPROVED) {
      throw new ForbiddenException('Your academy must be approved before this action is available.');
    }

    return academy;
  }

  async ensureOwnerAcademyApproved(ownerId: string): Promise<Academy> {
    return this.requireOwnerAcademy(ownerId, { requireApproved: true });
  }

  private async generateUniqueSlug(name: string, client: TransactionClient): Promise<string> {
    const base = this.slugify(name);
    for (let attempt = 0; attempt < 1000; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const existing = await client.academy.findUnique({
        where: { slug: candidate },
        select: { id: true },
      });
      if (!existing) {
        return candidate;
      }
    }
    throw new ConflictException('Unable to generate a unique academy slug, please try a different name.');
  }

  private slugify(input: string): string {
    const base = input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-');

    return base.length > 0 ? base : `academy-${Date.now()}`;
  }

  private async buildDefaultAcademyName(ownerId: string): Promise<string> {
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      select: { firstName: true, lastName: true, email: true },
    });

    if (owner) {
      const fullName = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim();
      if (fullName) {
        return `${fullName}'s Academy`;
      }

      if (owner.email) {
        const [local] = owner.email.split('@');
        if (local) {
          return `${local}'s Academy`;
        }
      }
    }

    return `academy-${Date.now()}`;
  }

  private async enforceMembershipLimit(userId: string, role: PrismaRole): Promise<void> {
    const settings = await this.platformSettingsService.getSettings();

    const limit =
      role === PrismaRole.TEACHER
        ? settings.maxAcademiesPerTeacher
        : settings.maxAcademiesPerStudent;

    if (!limit || limit <= 0) {
      return;
    }

    const currentCount = await this.prisma.academyMembership.count({
      where: {
        userId,
        status: {
          in: [AcademyMembershipStatus.APPROVED, AcademyMembershipStatus.PENDING],
        },
      },
    });

    if (currentCount >= limit) {
      const audience = role === PrismaRole.TEACHER ? 'teacher' : 'student';
      throw new ForbiddenException(
        `A ${audience} can join at most ${limit} academies. Please leave an existing academy before joining another.`,
      );
    }
  }
}


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
import { AcademyDetailEntity, AcademyMembershipEntity, AcademySummaryEntity } from './entities/academy.entity';
import { AcademyMembershipAction } from './dto/update-academy-membership-status.dto';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class AcademiesService {
  private readonly logger = new Logger(AcademiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly platformSettingsService: PlatformSettingsService,
  ) {}

  async createForOwner(params: {
    ownerId: string;
    name: string;
    description?: string | null;
  }): Promise<AcademyDetailEntity> {
    const existing = await this.prisma.academy.findUnique({
      where: { ownerId: params.ownerId },
    });
    if (existing) {
      return this.buildAcademyDetail(existing);
    }

    const trimmedName = params.name.trim();
    if (!trimmedName) {
      throw new BadRequestException('Academy name cannot be empty.');
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const slug = await this.generateUniqueSlug(trimmedName, tx);
      return tx.academy.create({
        data: {
          ownerId: params.ownerId,
          name: trimmedName,
          slug,
          description: params.description?.trim() || null,
        },
      });
    });

    this.logger.log(`Academy ${created.id} created for owner ${params.ownerId}`);
    return this.buildAcademyDetail(created);
  }

  async getAcademyForOwner(ownerId: string): Promise<AcademyDetailEntity> {
    const academy = await this.prisma.academy.findUnique({ where: { ownerId } });
    if (!academy) {
      throw new NotFoundException('No academy is associated with your account yet.');
    }

    return this.buildAcademyDetail(academy);
  }

  async listDirectory(query: AcademyDirectoryQueryDto): Promise<PaginatedResponse<AcademySummaryEntity>> {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.AcademyWhereInput = {};
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

  async listMembershipsForOwner(
    ownerId: string,
    query: AcademyMembershipQueryDto,
  ): Promise<PaginatedResponse<AcademyMembershipEntity>> {
    const academy = await this.prisma.academy.findUnique({ where: { ownerId } });
    if (!academy) {
      throw new NotFoundException('No academy associated with your account.');
    }

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
              role: true,
              status: true,
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
      const academy = await this.prisma.academy.findUnique({
        where: { ownerId: userId },
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

  private async buildAcademyDetail(record: Academy): Promise<AcademyDetailEntity> {
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

    return new AcademyDetailEntity({
      ...record,
      teacherCount,
      studentCount,
      pendingCount,
    });
  }

  private toSummaryEntity(record: Academy): AcademySummaryEntity {
    return new AcademySummaryEntity({
      id: record.id,
      name: record.name,
      slug: record.slug,
      description: record.description,
      ownerId: record.ownerId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  private toMembershipEntity(
    record: AcademyMembership & {
      user?: {
        id: string;
        firstName: string;
        lastName: string | null;
        email: string;
        role: PrismaRole;
        status: PrismaUserStatus;
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
            role: record.user.role,
            status: record.user.status,
          }
        : undefined,
      academy: record.academy
        ? this.toSummaryEntity(record.academy)
        : undefined,
    });
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

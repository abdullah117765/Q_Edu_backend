import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  Class,
  ClassParticipant,
  Prisma,
  Role as PrismaRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateZoomCreditTransactionDto,
  ZoomCreditOperation,
} from '../zoom-credits/dto/create-zoom-credit-transaction.dto';
import { ZoomCreditsService } from '../zoom-credits/zoom-credits.service';
import { ZoomParticipant } from '../zoom/interfaces/zoom.interface';
import { ZoomService } from '../zoom/zoom.service';
import { CreateClassDto } from './dto/create-class.dto';
import { ClassParticipantsQueryDto } from './dto/class-participants-query.dto';
import { ListClassesQueryDto } from './dto/list-classes-query.dto';
import { PaginatedClassParticipantsResponseDto } from './dto/paginated-class-participants-response.dto';
import { PaginatedClassesResponseDto } from './dto/paginated-classes-response.dto';
import { UpdateClassDto } from './dto/update-class.dto';
import { ClassParticipantEntity } from './entities/class-participant.entity';
import {
  ClassEntity,
  ClassTeacherSummaryEntity,
} from './entities/class.entity';
import { ClassParticipantRole } from './entities/class-participant-role.enum';
import { ClassStatus } from './entities/class-status.enum';

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly zoomService: ZoomService,
    private readonly zoomCreditsService: ZoomCreditsService,
  ) {}

  async create(
    dto: CreateClassDto,
    actorId?: string,
    actorRole?: PrismaRole,
  ): Promise<ClassEntity> {
    const start = new Date(dto.scheduledStart);
    const end = new Date(dto.scheduledEnd);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException(
        'Invalid date supplied for scheduledStart or scheduledEnd.',
      );
    }

    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException(
        'scheduledEnd must be later than scheduledStart.',
      );
    }

    const teacherId =
      actorRole === PrismaRole.TEACHER ? actorId : dto.teacherId;

    if (!teacherId) {
      throw new BadRequestException('Teacher identifier is required.');
    }

    if (
      actorRole === PrismaRole.TEACHER &&
      dto.teacherId &&
      dto.teacherId !== actorId
    ) {
      throw new ForbiddenException(
        'Teachers can only schedule classes for themselves.',
      );
    }

    const teacher = await this.prisma.user.findUnique({
      where: { id: teacherId },
    });
    if (!teacher) {
      throw new NotFoundException('Teacher not found.');
    }

    const durationMinutes = Math.max(
      Math.round((end.getTime() - start.getTime()) / 60000),
      1,
    );
    const hostIdentifier = teacher.zoomUserId ?? teacher.email;

    const zoomMeeting = await this.zoomService.createMeeting(hostIdentifier, {
      topic: dto.title,
      agenda: dto.description,
      start_time: start.toISOString(),
      duration: durationMinutes,
      timezone: dto.timezone,
      settings: dto.zoomSettings ? { ...dto.zoomSettings } : undefined,
    });

    const classId = await this.prisma.$transaction(async (tx) => {
      const created = await tx.class.create({
        data: {
          title: dto.title,
          description: dto.description,
          teacherId,
          scheduledStart: start,
          scheduledEnd: end,
          durationMinutes,
          timezone: dto.timezone,
          creditsConsumed: dto.creditsConsumed,
          zoomMeetingId: zoomMeeting.id.toString(),
          zoomHostId: zoomMeeting.host_id,
          zoomJoinUrl: zoomMeeting.join_url,
          zoomStartUrl: zoomMeeting.start_url,
          zoomPassword: zoomMeeting.password,
          zoomUuid: zoomMeeting.uuid,
          metadata: this.toInputJson(dto.metadata),
          status: ClassStatus.UPCOMING,
        },
      });

      if (dto.participants?.length) {
        await tx.classParticipant.createMany({
          data: dto.participants.map((participant) => ({
            classId: created.id,
            userId: participant.userId,
            email: participant.email,
            displayName: participant.displayName,
            role: participant.role ?? ClassParticipantRole.STUDENT,
            metadata: participant.userId
              ? undefined
              : (this.toInputJson({
                  source: 'manual',
                }) as Prisma.InputJsonValue),
          })),
        });
      }

      return created.id;
    });

    this.logger.log(
      `Created class ${classId} with Zoom meeting ${zoomMeeting.id}`,
    );
    return this.findOne(classId);
  }

  async findAll(
    query: ListClassesQueryDto,
  ): Promise<PaginatedClassesResponseDto> {
    const baseWhere: Prisma.ClassWhereInput = {
      ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      ...(query.from || query.to
        ? {
            scheduledStart: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const search = query.search?.trim();
    if (search) {
      baseWhere.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const where: Prisma.ClassWhereInput = {
      ...baseWhere,
      ...(query.status ? { status: query.status } : {}),
    };

    const skip = (query.page - 1) * query.limit;
    const [total, classes, statusGroups] = await this.prisma.$transaction([
      this.prisma.class.count({ where }),
      this.prisma.class.findMany({
        where,
        orderBy: { scheduledStart: 'desc' },
        skip,
        take: query.limit,
        include: {
          teacher: true,
          _count: { select: { participants: true } },
        },
      }),
      this.prisma.class.groupBy({
        by: ['status'],
        where: baseWhere,
        orderBy: { status: 'asc' },
        _count: { _all: true },
      }),
    ]);

    const totalPages = Math.max(Math.ceil((total || 1) / query.limit), 1);

    const statusCountMap = statusGroups.reduce<Record<ClassStatus, number>>(
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
        [ClassStatus.UPCOMING]: 0,
        [ClassStatus.ONGOING]: 0,
        [ClassStatus.ENDED]: 0,
        [ClassStatus.CANCELLED]: 0,
      },
    );

    return {
      data: classes.map((cls) => this.toClassEntity(cls)),
      meta: {
        total,
        count: classes.length,
        currentPage: query.page,
        totalPages,
        nextPage: query.page < totalPages ? query.page + 1 : null,
        previousPage: query.page > 1 ? query.page - 1 : null,
      },
      summary: this.buildClassSummary(statusCountMap),
    };
  }

  async findOne(id: string): Promise<ClassEntity> {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      include: {
        teacher: true,
        participants: true,
        _count: { select: { participants: true } },
      },
    });

    if (!cls) {
      throw new NotFoundException('Class not found.');
    }

    return this.toClassEntity(cls);
  }

  async update(
    id: string,
    dto: UpdateClassDto,
    actorId?: string,
    actorRole?: PrismaRole,
  ): Promise<ClassEntity> {
    const existing = await this.prisma.class.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Class not found.');
    }

    if (actorRole === PrismaRole.TEACHER) {
      if (!actorId || existing.teacherId !== actorId) {
        throw new ForbiddenException(
          'Teachers can only update their own classes.',
        );
      }
      if (dto.teacherId && dto.teacherId !== actorId) {
        throw new ForbiddenException(
          'Teachers cannot reassign classes to other instructors.',
        );
      }
    }

    const effectiveTeacherId =
      actorRole === PrismaRole.TEACHER
        ? actorId
        : (dto.teacherId ?? existing.teacherId);

    const start = dto.scheduledStart
      ? new Date(dto.scheduledStart)
      : existing.scheduledStart;
    const end = dto.scheduledEnd
      ? new Date(dto.scheduledEnd)
      : existing.scheduledEnd;

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException(
        'Invalid date supplied for scheduledStart or scheduledEnd.',
      );
    }

    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException(
        'scheduledEnd must be later than scheduledStart.',
      );
    }

    let durationMinutes = existing.durationMinutes;
    if (dto.scheduledStart || dto.scheduledEnd) {
      durationMinutes = Math.max(
        Math.round((end.getTime() - start.getTime()) / 60000),
        1,
      );
    }

    if (existing.zoomMeetingId) {
      try {
        await this.zoomService.updateMeeting(existing.zoomMeetingId, {
          topic: dto.title ?? existing.title,
          agenda: dto.description ?? existing.description ?? undefined,
          start_time: start.toISOString(),
          duration: durationMinutes,
          timezone: dto.timezone ?? existing.timezone,
          settings: dto.zoomSettings ? { ...dto.zoomSettings } : undefined,
        });
      } catch (error) {
        this.logger.error(
          `Failed to update Zoom meeting for class ${id}: ${(error as Error).message}`,
        );
        throw error;
      }
    }

    const updated = await this.prisma.class.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        teacherId: effectiveTeacherId ?? existing.teacherId,
        scheduledStart: start,
        scheduledEnd: end,
        durationMinutes,
        timezone: dto.timezone,
        creditsConsumed: dto.creditsConsumed ?? existing.creditsConsumed,
        status: dto.status ?? existing.status,
        metadata:
          dto.metadata !== undefined
            ? this.toInputJson(dto.metadata)
            : (existing.metadata as Prisma.InputJsonValue),
      },
      select: {
        id: true,
        title: true,
        teacherId: true,
        scheduledStart: true,
        creditsConsumed: true,
        zoomMeetingId: true,
      },
    });

    if (dto.status === ClassStatus.CANCELLED && existing.zoomMeetingId) {
      await this.safeDeleteZoomMeeting(existing.zoomMeetingId);
    }

    if (
      dto.creditsConsumed &&
      (existing.creditsConsumed ?? 0) < dto.creditsConsumed
    ) {
      const delta = dto.creditsConsumed - (existing.creditsConsumed ?? 0);
      await this.consumeCreditsForClass(
        updated.id,
        updated.teacherId,
        updated.title,
        start,
        delta,
        actorId,
      );
    }

    this.logger.log(`Updated class ${id}`);
    return this.findOne(id);
  }

  async remove(
    id: string,
    actorId?: string,
    actorRole?: PrismaRole,
  ): Promise<void> {
    const existing = await this.prisma.class.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Class not found.');
    }

    if (actorRole === PrismaRole.TEACHER) {
      if (!actorId || existing.teacherId !== actorId) {
        throw new ForbiddenException(
          'Teachers can only delete their own classes.',
        );
      }
    }

    await this.prisma.$transaction([
      this.prisma.classParticipant.deleteMany({ where: { classId: id } }),
      this.prisma.class.delete({ where: { id } }),
    ]);

    if (existing.zoomMeetingId) {
      await this.safeDeleteZoomMeeting(existing.zoomMeetingId);
    }

    this.logger.log(`Deleted class ${id}`);
  }

  async getParticipants(
    classId: string,
    query: ClassParticipantsQueryDto,
  ): Promise<PaginatedClassParticipantsResponseDto> {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) {
      throw new NotFoundException('Class not found.');
    }

    const offset = (query.page - 1) * query.limit;
    const searchFilter = query.search
      ? Prisma.sql`AND (cp.email LIKE ${`%${query.search}%`} OR cp.display_name LIKE ${`%${query.search}%`})`
      : Prisma.sql``;

    const rows = await this.prisma.$queryRaw<
      (ClassParticipant & { total_count: bigint })[]
    >(Prisma.sql`
      SELECT
        cp.*, COUNT(*) OVER() AS total_count
      FROM ClassParticipant cp
      WHERE cp.class_id = ${classId}
      ${searchFilter}
      ORDER BY cp.join_time DESC, cp.created_at DESC
      LIMIT ${query.limit} OFFSET ${offset};
    `);

    const total = rows[0]?.total_count ? Number(rows[0].total_count) : 0;
    const totalPages =
      total === 0 ? 1 : Math.max(Math.ceil(total / query.limit), 1);

    return {
      data: rows.map((row) => this.toParticipantEntity(row)),
      meta: {
        total,
        count: rows.length,
        currentPage: query.page,
        totalPages,
        nextPage: query.page < totalPages ? query.page + 1 : null,
        previousPage: query.page > 1 ? query.page - 1 : null,
      },
    };
  }

  async syncParticipantsFromZoom(classId: string): Promise<number> {
    const cls = await this.prisma.class.findUnique({ where: { id: classId } });
    if (!cls) {
      throw new NotFoundException('Class not found.');
    }

    if (!cls.zoomMeetingId) {
      throw new BadRequestException(
        'Class does not have an associated Zoom meeting.',
      );
    }

    const participants: ZoomParticipant[] = [];
    let nextPageToken: string | undefined;

    do {
      const response = await this.zoomService.getMeetingParticipants(
        cls.zoomMeetingId,
        {
          pageSize: 300,
          nextPageToken,
        },
      );
      participants.push(...response.participants);
      nextPageToken = response.next_page_token ?? undefined;
    } while (nextPageToken);

    await this.prisma.$transaction(async (tx) => {
      await tx.classParticipant.deleteMany({ where: { classId } });
      if (participants.length === 0) {
        return;
      }

      await tx.classParticipant.createMany({
        data: participants.map((participant) => ({
          classId,
          email: participant.user_email,
          displayName: participant.name,
          role: ClassParticipantRole.STUDENT,
          joinTime: participant.join_time
            ? new Date(participant.join_time)
            : undefined,
          leaveTime: participant.leave_time
            ? new Date(participant.leave_time)
            : undefined,
          durationSeconds: participant.duration ?? undefined,
          zoomParticipantUuid:
            participant.id ??
            participant.user_id ??
            participant.user_email ??
            undefined,
          metadata: this.toInputJson({
            attentiveness_score: participant.attentiveness_score ?? null,
            status: participant.status ?? null,
          }),
        })),
      });
    });

    this.logger.log(
      `Synced ${participants.length} participants from Zoom for class ${classId}`,
    );
    return participants.length;
  }

  private buildClassSummary(counts: Record<ClassStatus, number>): {
    upcoming: number;
    ongoing: number;
    ended: number;
    cancelled: number;
  } {
    return {
      upcoming: counts[ClassStatus.UPCOMING] ?? 0,
      ongoing: counts[ClassStatus.ONGOING] ?? 0,
      ended: counts[ClassStatus.ENDED] ?? 0,
      cancelled: counts[ClassStatus.CANCELLED] ?? 0,
    };
  }

  private toClassEntity(
    record: Class & {
      teacher: {
        id: string;
        firstName: string;
        lastName: string | null;
        email: string;
      } | null;
      participants?: ClassParticipant[];
      _count: { participants: number };
    },
  ): ClassEntity {
    return new ClassEntity({
      ...record,
      metadata: this.toPlainMetadata(record.metadata),
      participantsCount:
        record._count?.participants ?? record.participants?.length ?? 0,
      participants: record.participants?.map((participant) =>
        this.toParticipantEntity(participant),
      ),
      teacher: record.teacher
        ? new ClassTeacherSummaryEntity({
            id: record.teacher.id,
            firstName: record.teacher.firstName,
            lastName: record.teacher.lastName,
            email: record.teacher.email,
          })
        : undefined,
    });
  }

  private toParticipantEntity(
    participant: ClassParticipant,
  ): ClassParticipantEntity {
    return new ClassParticipantEntity({
      ...participant,
      metadata: this.toPlainMetadata(participant.metadata),
    });
  }

  private toInputJson(
    value?: Record<string, unknown> | null,
  ): Prisma.InputJsonValue | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    return value as Prisma.InputJsonValue;
  }

  private toPlainMetadata(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Record<string, unknown>;
  }

  private async consumeCreditsForClass(
    classId: string,
    teacherId: string,
    title: string,
    scheduledStart: Date,
    amount: number,
    actorId?: string,
  ): Promise<void> {
    if (amount <= 0) {
      return;
    }

    const dto: CreateZoomCreditTransactionDto = {
      userId: teacherId,
      operation: ZoomCreditOperation.DEBIT,
      amount,
      reason: `Zoom usage for class ${title}`,
      classId,
      metadata: {
        classTitle: title,
        scheduledStart,
      },
    };

    try {
      await this.zoomCreditsService.adjustCredits(dto, actorId);
    } catch (error) {
      this.logger.error(
        `Failed to deduct credits for class ${classId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private async safeDeleteZoomMeeting(meetingId: string): Promise<void> {
    try {
      await this.zoomService.deleteMeeting(meetingId);
    } catch (error) {
      this.logger.warn(
        `Failed to delete Zoom meeting ${meetingId}: ${(error as Error).message}`,
      );
    }
  }
}

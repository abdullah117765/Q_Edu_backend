import {
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException
} from '@nestjs/common';
import { RecordingSource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRecordingDto } from './dto/create-recording.dto';
import { RecordingsQueryDto } from './dto/recordings-query.dto';

const INCLUDE_RELATIONS = {
  class: {
    select: {
      title: true,
      scheduledStart: true,
      teacher: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      academy: {
        select: { id: true, name: true },
      },
    },
  },
} as const;

@Injectable()
export class RecordingsService {
  private readonly logger = new Logger(RecordingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Super-admin: all recordings ────────────────────────────────────────────
  async findAll(query: RecordingsQueryDto) {
    const {
      page = 1,
      limit = 20,
      academyId,
      teacherId,
      from,
      to,
      source,
      search,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (academyId) where.academyId = academyId;
    if (teacherId) where.teacherId = teacherId;
    if (source) where.source = source as RecordingSource;
    if (from || to) {
      where.startTime = {};
      if (from) where.startTime.gte = new Date(from);
      if (to) where.startTime.lte = new Date(to);
    }
    if (search) {
      where.OR = [
        { topic: { contains: search } },
        { zoomMeetingId: { contains: search } },
        { class: { title: { contains: search } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.classRecording.findMany({
        where,
        include: INCLUDE_RELATIONS,
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.classRecording.count({ where }),
    ]);

    return {
      data: data.map(this.serialize),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Academy owner: only their academy ──────────────────────────────────────
  async findForAcademy(ownerId: string, query: RecordingsQueryDto) {
    const academy = await this.prisma.academy.findUnique({
      where: { ownerId },
      select: { id: true },
    });
    if (!academy) throw new NotFoundException('Academy not found.');

    return this.findAll({ ...query, academyId: academy.id });
  }

  // ─── Manual create (local recordings / override) ────────────────────────────
  async create(actorId: string, actorRole: string, dto: CreateRecordingDto) {
    const cls = await this.prisma.class.findUnique({
      where: { id: dto.classId },
      select: {
        id: true,
        academyId: true,
        teacherId: true,
        academy: { select: { ownerId: true } },
      },
    });
    if (!cls) throw new NotFoundException('Class not found.');

    // Only super-admin, the academy owner, or the teacher themselves may add recordings
    if (actorRole !== 'SUPER_ADMIN') {
      const isOwner = cls.academy?.ownerId === actorId;
      const isTeacher = cls.teacherId === actorId;
      if (!isOwner && !isTeacher) {
        throw new ForbiddenException(
          'You are not allowed to add recordings for this class.',
        );
      }
    }

    const recording = await this.prisma.classRecording.create({
      data: {
        classId: cls.id,
        academyId: cls.academyId,
        teacherId: cls.teacherId,
        source: dto.source as RecordingSource,
        // Ensure local recordings have a startTime so they sort correctly
        // (NULL startTime sorts to the END with ORDER BY startTime DESC)
        startTime: new Date(),
        playUrl: dto.playUrl ?? null,
        downloadUrl: dto.downloadUrl ?? null,
        password: dto.password ?? null,
        topic: dto.topic ?? null,
        status: 'completed',
      },
      include: INCLUDE_RELATIONS,
    });

    return this.serialize(recording);
  }

  // ─── Zoom cloud webhook handler ──────────────────────────────────────────────
  async handleZoomRecordingCompleted(payload: any): Promise<void> {
    try {
      const object = payload?.payload?.object;
      if (!object) return;

      const zoomMeetingId = object.id?.toString();
      if (!zoomMeetingId) return;

      // Find the class by Zoom meeting ID
      const cls = await this.prisma.class.findUnique({
        where: { zoomMeetingId },
        select: { id: true, academyId: true, teacherId: true },
      });

      if (!cls) {
        this.logger.warn(
          `Zoom recording.completed: no class found for meeting ${zoomMeetingId}`,
        );
        return;
      }

      const recordingFiles: any[] = object.recording_files ?? [];
      const topic: string = object.topic ?? '';
      const startTime = object.start_time ? new Date(object.start_time) : null;

      for (const file of recordingFiles) {
        if (file.file_type !== 'MP4' && file.file_type !== 'M4A') continue;

        const zoomRecordingId = file.id as string;
        if (!zoomRecordingId) continue;

        // Idempotent upsert — Zoom can fire the webhook multiple times
        await this.prisma.classRecording.upsert({
          where: { zoomRecordingId },
          create: {
            classId: cls.id,
            academyId: cls.academyId,
            teacherId: cls.teacherId,
            source: RecordingSource.ZOOM_CLOUD,
            zoomMeetingId,
            zoomRecordingId,
            topic,
            startTime,
            endTime: file.recording_end ? new Date(file.recording_end) : null,
            durationSeconds: file.file_size ? null : null,
            fileSize: file.file_size ? BigInt(file.file_size) : null,
            playUrl: file.play_url ?? null,
            downloadUrl: file.download_url ?? null,
            password: object.password ?? null,
            status: file.status ?? 'completed',
            rawPayload: payload,
          },
          update: {
            playUrl: file.play_url ?? undefined,
            downloadUrl: file.download_url ?? undefined,
            status: file.status ?? 'completed',
            rawPayload: payload,
          },
        });

        this.logger.log(
          `Saved cloud recording ${zoomRecordingId} for class ${cls.id} (meeting ${zoomMeetingId})`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to process Zoom recording webhook: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  private serialize(r: any) {
    return {
      ...r,
      // BigInt is not JSON-serialisable — convert to string
      fileSizeBytes:
        r.fileSize !== null && r.fileSize !== undefined
          ? r.fileSize.toString()
          : null,
      fileSize: undefined,
    };
  }
}

import { RecordingSource } from '@prisma/client';

export class RecordingEntity {
  id: string;
  classId: string;
  academyId: string;
  teacherId: string;
  source: RecordingSource;
  zoomMeetingId?: string | null;
  zoomRecordingId?: string | null;
  topic?: string | null;
  startTime?: Date | string | null;
  endTime?: Date | string | null;
  durationSeconds?: number | null;
  fileSizeBytes?: string | null;
  playUrl?: string | null;
  downloadUrl?: string | null;
  password?: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  /** Populated relations */
  class?: {
    title: string;
    scheduledStart: Date;
    teacher?: {
      id: string;
      firstName: string;
      lastName?: string | null;
      email: string;
    } | null;
    academy?: { id: string; name: string } | null;
  } | null;
}

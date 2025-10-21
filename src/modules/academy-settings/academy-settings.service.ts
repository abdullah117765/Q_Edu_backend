import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateAcademySettingsDto } from './dto/update-academy-settings.dto';
import { AcademySettingsEntity } from './entities/academy-settings.entity';

type AcademySettingsMap = {
  allowTeacherSelfRegistration: boolean;
  autoApproveStudents: boolean;
  notifyOwnerOnNewRegistration: boolean;
  requireZoomPassword: boolean;
  defaultClassDurationMinutes: number;
};

const DEFAULT_SETTINGS: AcademySettingsMap = {
  allowTeacherSelfRegistration: true,
  autoApproveStudents: false,
  notifyOwnerOnNewRegistration: true,
  requireZoomPassword: true,
  defaultClassDurationMinutes: 60,
};

@Injectable()
export class AcademySettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(ownerId: string): Promise<AcademySettingsEntity> {
    const settings = await this.prisma.academySetting.findMany({
      where: { ownerId },
    });

    const shape: AcademySettingsMap = { ...DEFAULT_SETTINGS };
    settings.forEach((entry) => {
      if (this.isSupportedKey(entry.key)) {
        const key = entry.key as keyof AcademySettingsMap;
        (shape as Record<string, boolean | number>)[key] = this.fromJsonValue(
          key,
          entry.value,
        );
      }
    });

    return new AcademySettingsEntity({
      ...shape,
      updatedAt:
        settings.reduce(
          (latest, entry) =>
            entry.updatedAt > latest ? entry.updatedAt : latest,
          new Date(0),
        ) ?? new Date(0),
    });
  }

  async updateSettings(
    ownerId: string,
    dto: UpdateAcademySettingsDto,
  ): Promise<AcademySettingsEntity> {
    const updates = Object.entries(dto).filter(
      ([, value]) => value !== undefined,
    ) as Array<
      [keyof AcademySettingsMap, AcademySettingsMap[keyof AcademySettingsMap]]
    >;

    if (updates.length === 0) {
      throw new BadRequestException('No settings provided to update.');
    }

    const operations = updates.map(([key, value]) =>
      this.prisma.academySetting.upsert({
        where: { ownerId_key: { ownerId, key } },
        create: {
          ownerId,
          key,
          value: this.toJsonValue(value),
        },
        update: {
          value: this.toJsonValue(value),
        },
      }),
    );

    await this.prisma.$transaction(operations, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });

    return this.getSettings(ownerId);
  }
  private toJsonValue(
    value: AcademySettingsMap[keyof AcademySettingsMap],
  ): Prisma.InputJsonValue {
    if (typeof value === 'boolean' || typeof value === 'number') {
      return value;
    }
    return value as Prisma.InputJsonValue;
  }

  private fromJsonValue<K extends keyof AcademySettingsMap>(
    key: K,
    value: Prisma.JsonValue,
  ): AcademySettingsMap[K] {
    const defaultValue = DEFAULT_SETTINGS[key];
    if (typeof defaultValue === 'boolean') {
      if (typeof value === 'boolean') {
        return value as AcademySettingsMap[K];
      }
      if (typeof value === 'string') {
        return (value === 'true') as AcademySettingsMap[K];
      }
      return defaultValue;
    }

    if (typeof defaultValue === 'number') {
      if (typeof value === 'number') {
        return value as AcademySettingsMap[K];
      }
      if (typeof value === 'string') {
        const parsed = Number(value);
        return (
          Number.isFinite(parsed) ? parsed : defaultValue
        ) as AcademySettingsMap[K];
      }
      return defaultValue;
    }

    return defaultValue;
  }

  private isSupportedKey(value: string): value is keyof AcademySettingsMap {
    return Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, value);
  }
}

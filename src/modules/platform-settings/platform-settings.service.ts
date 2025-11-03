import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PlatformSetting, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdatePlatformSettingsDto } from './dto/update-platform-settings.dto';
import { PlatformSettingsEntity } from './entities/platform-settings.entity';

type PlatformSettingsMap = {
  sessionTimeoutMinutes: number;
  zoomCreditLowThreshold: number;
  maxConcurrentClasses: number;
  dailyDigestEmail: boolean;
  supportEmail: string;
  maxAcademiesPerTeacher: number;
  maxAcademiesPerStudent: number;
};

type PlatformSettingRecord = PlatformSetting & {
  updatedBy?: {
    firstName: string;
    lastName: string | null;
    email: string;
  } | null;
};

const DEFAULT_SETTINGS: PlatformSettingsMap = {
  sessionTimeoutMinutes: 60,
  zoomCreditLowThreshold: 100,
  maxConcurrentClasses: 12,
  dailyDigestEmail: true,
  supportEmail: 'support@qedu.io',
  maxAcademiesPerTeacher: 3,
  maxAcademiesPerStudent: 1,
};

@Injectable()
export class PlatformSettingsService {
  private readonly logger = new Logger(PlatformSettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<PlatformSettingsEntity> {
    const records = await this.fetchSettingsRecords();
    return this.toEntity(records);
  }

  async updateSettings(
    dto: UpdatePlatformSettingsDto,
    updatedById: string | null,
  ): Promise<PlatformSettingsEntity> {
    const updates = Object.entries(dto).filter(
      ([, value]) => value !== undefined,
    ) as Array<
      [
        keyof PlatformSettingsMap,
        PlatformSettingsMap[keyof PlatformSettingsMap],
      ]
    >;

    if (updates.length === 0) {
      throw new BadRequestException('No settings provided to update.');
    }

    const validKeys = new Set<keyof PlatformSettingsMap>(
      Object.keys(DEFAULT_SETTINGS) as Array<keyof PlatformSettingsMap>,
    );

    await this.ensureDefaults();

    await this.prisma.$transaction(
      updates.map(([key, value]) => {
        if (!validKeys.has(key)) {
          throw new BadRequestException(
            `Unsupported platform setting "${key}".`,
          );
        }

        return this.prisma.platformSetting.update({
          where: { key },
          data: {
            value: this.toJsonValue(value),
            updatedById: updatedById ?? undefined,
          },
        });
      }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.logger.log(
      `Platform settings updated by ${updatedById ?? 'system'}: ${updates.map(([key]) => key).join(', ')}`,
    );

    const records = await this.fetchSettingsRecords();
    return this.toEntity(records);
  }

  private async fetchSettingsRecords(): Promise<PlatformSettingRecord[]> {
    await this.ensureDefaults();

    const records = await this.prisma.platformSetting.findMany({
      include: {
        updatedBy: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            id: true,
          },
        },
      },
    });

    return records ?? [];
  }

  private async ensureDefaults(): Promise<void> {
    const existing = await this.prisma.platformSetting.findMany({
      select: { key: true },
    });
    const existingKeys = new Set(existing.map((record) => record.key));

    const missingEntries = Object.entries(DEFAULT_SETTINGS).filter(
      ([key]) => !existingKeys.has(key),
    );
    if (missingEntries.length === 0) {
      return;
    }

    await this.prisma.platformSetting.createMany({
      data: missingEntries.map(([key, value]) => ({
        key,
        value: this.toJsonValue(value),
      })),
      skipDuplicates: true,
    });
  }

  private toEntity(records: PlatformSettingRecord[]): PlatformSettingsEntity {
    const shape: PlatformSettingsMap = { ...DEFAULT_SETTINGS };
    let latestUpdatedAt: Date | null = null;
    let latestUpdatedById: string | null = null;
    let latestUpdatedByName: string | null = null;

    const buildDisplayName = (
      firstName?: string,
      lastName?: string | null,
      email?: string,
    ) => {
      const parts = [firstName?.trim(), lastName?.trim()].filter(
        Boolean,
      ) as string[];
      return parts.length > 0 ? parts.join(' ') : (email ?? null);
    };

    for (const record of records) {
      if (this.isSupportedKey(record.key)) {
        const key = record.key as keyof PlatformSettingsMap;
        Object.assign(shape, { [key]: this.fromJsonValue(key, record.value) });
      }

      if (!latestUpdatedAt || record.updatedAt > latestUpdatedAt) {
        latestUpdatedAt = record.updatedAt;
        latestUpdatedById = record.updatedById ?? null;
        latestUpdatedByName = record.updatedBy
          ? buildDisplayName(
              record.updatedBy.firstName,
              record.updatedBy.lastName,
              record.updatedBy.email,
            )
          : null;
      }
    }

    return new PlatformSettingsEntity({
      ...shape,
      updatedAt: latestUpdatedAt ?? new Date(0),
      updatedById: latestUpdatedById,
      updatedByName: latestUpdatedByName,
    });
  }

  private toJsonValue(
    value: PlatformSettingsMap[keyof PlatformSettingsMap],
  ): Prisma.InputJsonValue {
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'string'
    ) {
      return value;
    }
    return value as Prisma.InputJsonValue;
  }

  private fromJsonValue<K extends keyof PlatformSettingsMap>(
    key: K,
    value: Prisma.JsonValue,
  ): PlatformSettingsMap[K] {
    const defaultValue = DEFAULT_SETTINGS[key];
    if (typeof defaultValue === 'number') {
      if (typeof value === 'number') {
        return value as PlatformSettingsMap[K];
      }
      if (typeof value === 'string') {
        const parsed = Number(value);
        return (
          Number.isFinite(parsed) ? parsed : defaultValue
        ) as PlatformSettingsMap[K];
      }
      return defaultValue;
    }

    if (typeof defaultValue === 'boolean') {
      if (typeof value === 'boolean') {
        return value as PlatformSettingsMap[K];
      }
      if (typeof value === 'string') {
        return (value === 'true') as PlatformSettingsMap[K];
      }
      return defaultValue;
    }

    if (typeof defaultValue === 'string') {
      if (typeof value === 'string') {
        return value as PlatformSettingsMap[K];
      }
      return defaultValue;
    }

    return defaultValue;
  }

  private isSupportedKey(key: string): key is keyof PlatformSettingsMap {
    return Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key);
  }
}

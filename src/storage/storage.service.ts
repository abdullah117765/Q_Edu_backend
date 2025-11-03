import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, extname, join, posix } from 'path';

type StorageConfig = {
  driver: string;
  local?: {
    root?: string;
  };
  publicServeRoot?: string;
  publicBaseUrl?: string;
};

type SaveFileOptions = {
  buffer: Buffer;
  originalName: string;
  directory?: string;
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  private readonly driver: string;

  private readonly localRoot: string;

  private readonly publicServeRoot: string;

  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const storageConfig = this.configService.get<StorageConfig>('storage') ?? {
      driver: 'local',
    };

    this.driver = storageConfig.driver ?? 'local';
    this.localRoot = storageConfig.local?.root ?? join(process.cwd(), 'storage', 'uploads');
    this.publicServeRoot = storageConfig.publicServeRoot ?? '/storage';
    this.publicBaseUrl = storageConfig.publicBaseUrl ?? '';
  }

  async saveFile(options: SaveFileOptions): Promise<{ key: string; url: string }> {
    if (this.driver !== 'local') {
      throw new InternalServerErrorException('No storage driver is configured.');
    }

    const { buffer, originalName, directory } = options;
    const sanitizedName = this.sanitiseFilename(originalName);
    const extension = extname(sanitizedName);
    const key = posix.join(directory ?? 'profile-photos', `${randomUUID()}${extension}`);

    const absolutePath = join(this.localRoot, key);
    await this.ensureDirectoryExists(absolutePath);

    try {
      await fs.writeFile(absolutePath, buffer);
    } catch (error) {
      this.logger.error(`Failed to write file ${absolutePath}: ${(error as Error).message}`);
      throw new InternalServerErrorException('Unable to persist uploaded file.');
    }

    return {
      key,
      url: this.buildPublicUrl(key),
    };
  }

  async deleteFile(key: string | null | undefined): Promise<void> {
    if (!key || this.driver !== 'local') {
      return;
    }

    const absolutePath = join(this.localRoot, key);
    try {
      await fs.unlink(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.logger.warn(`Failed to delete stored file ${absolutePath}: ${(error as Error).message}`);
      }
    }
  }

  private async ensureDirectoryExists(filePath: string): Promise<void> {
    const directory = dirname(filePath);

    try {
      await fs.mkdir(directory, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to ensure storage directory ${directory}: ${(error as Error).message}`);
      throw new InternalServerErrorException('Unable to initialise storage directory.');
    }
  }

  private sanitiseFilename(name: string): string {
    const trimmed = name?.trim() ?? '';
    if (!trimmed) {
      return 'file';
    }

    return trimmed.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  }

  private buildPublicUrl(key: string): string {
    const normalizedKey = key.replace(/\\/g, '/');
    if (this.publicBaseUrl) {
      return `${this.publicBaseUrl.replace(/\/$/, '')}/${normalizedKey}`;
    }

    const prefix = this.publicServeRoot.endsWith('/')
      ? this.publicServeRoot.slice(0, -1)
      : this.publicServeRoot;
    return `${prefix}/${normalizedKey}`;
  }
}
